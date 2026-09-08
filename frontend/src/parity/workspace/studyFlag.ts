export function studyUiRequested() {
  return new URLSearchParams(location.search).get("ui") === "study" || localStorage.getItem("thejimmyapp.ui") === "study";
}
