from __future__ import annotations

import pytest

from backend.job_control import BoundedJobRegistry, JobCapacityError


def test_registry_rejects_an_unbounded_active_queue() -> None:
    registry = BoundedJobRegistry(max_active=1, max_records=3, ttl_seconds=60)
    registry.reserve({"status": "queued"})

    with pytest.raises(JobCapacityError):
        registry.reserve({"status": "queued"})


def test_registry_expires_terminal_jobs_and_never_exposes_internal_timestamps() -> None:
    now = [10.0]
    registry = BoundedJobRegistry(
        max_active=1,
        max_records=2,
        ttl_seconds=5,
        clock=lambda: now[0],
    )
    job_id = registry.reserve({"status": "queued", "stage": "waiting"})
    registry.replace(job_id, {"status": "completed", "stage": "done"})

    assert registry.get(job_id) == {"status": "completed", "stage": "done"}
    now[0] = 16.0
    assert registry.get(job_id) is None
    assert registry.record_count() == 0


def test_registry_discards_old_terminal_records_before_rejecting_new_work() -> None:
    registry = BoundedJobRegistry(max_active=2, max_records=2, ttl_seconds=60)
    first = registry.reserve({"status": "queued"})
    registry.replace(first, {"status": "completed"})
    second = registry.reserve({"status": "queued"})
    third = registry.reserve({"status": "queued"})

    assert registry.get(first) is None
    assert registry.get(second)["status"] == "queued"
    assert registry.get(third)["status"] == "queued"
