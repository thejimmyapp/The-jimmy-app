from __future__ import annotations

from collections import OrderedDict
from threading import Lock
import time
from typing import Callable
from uuid import uuid4


TERMINAL_STATUSES = {"completed", "failed"}


class JobCapacityError(RuntimeError):
    def __init__(self, message: str, retry_after_seconds: int = 30) -> None:
        super().__init__(message)
        self.retry_after_seconds = retry_after_seconds


class BoundedJobRegistry:
    """A process-local, bounded job ledger with terminal-record expiry."""

    def __init__(
        self,
        *,
        max_active: int,
        max_records: int,
        ttl_seconds: int,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.max_active = max_active
        self.max_records = max_records
        self.ttl_seconds = ttl_seconds
        self._clock = clock
        self._records: OrderedDict[str, dict[str, object]] = OrderedDict()
        self._lock = Lock()

    def reserve(self, payload: dict[str, object]) -> str:
        with self._lock:
            self._prune_locked()
            active = sum(
                1 for record in self._records.values()
                if record.get("status") not in TERMINAL_STATUSES
            )
            if active >= self.max_active:
                raise JobCapacityError(
                    "The local compute queue is full; retry after an active job finishes"
                )
            self._make_record_space_locked()
            if len(self._records) >= self.max_records:
                raise JobCapacityError(
                    "The local job ledger is at capacity; retry after completed jobs expire"
                )
            job_id = str(uuid4())
            self._records[job_id] = {**payload, "_updated_at": self._clock()}
            return job_id

    def get(self, job_id: str) -> dict[str, object] | None:
        with self._lock:
            self._prune_locked()
            record = self._records.get(job_id)
            return self._public(record) if record else None

    def replace(self, job_id: str, payload: dict[str, object]) -> None:
        with self._lock:
            if job_id not in self._records:
                return
            self._records[job_id] = {**payload, "_updated_at": self._clock()}
            self._records.move_to_end(job_id)

    def update(self, job_id: str, **changes: object) -> None:
        with self._lock:
            record = self._records.get(job_id)
            if not record:
                return
            self._records[job_id] = {
                **record,
                **changes,
                "_updated_at": self._clock(),
            }
            self._records.move_to_end(job_id)

    def queued_position(self, job_id: str) -> int | None:
        with self._lock:
            self._prune_locked()
            queued = [
                key for key, record in self._records.items()
                if record.get("status") == "queued"
            ]
            return queued.index(job_id) + 1 if job_id in queued else None

    def record_count(self) -> int:
        with self._lock:
            self._prune_locked()
            return len(self._records)

    def _make_record_space_locked(self) -> None:
        while len(self._records) >= self.max_records:
            removable = next(
                (
                    key for key, record in self._records.items()
                    if record.get("status") in TERMINAL_STATUSES
                ),
                None,
            )
            if removable is None:
                return
            del self._records[removable]

    def _prune_locked(self) -> None:
        now = self._clock()
        expired = [
            key
            for key, record in self._records.items()
            if record.get("status") in TERMINAL_STATUSES
            and now - float(record.get("_updated_at") or now) >= self.ttl_seconds
        ]
        for key in expired:
            del self._records[key]

    @staticmethod
    def _public(record: dict[str, object]) -> dict[str, object]:
        return {key: value for key, value in record.items() if not key.startswith("_")}
