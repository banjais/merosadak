export async function fetchDeployStatus() {
  const res = await fetch(
    "https://api.github.com/repos/banjais/merosadak/actions/runs"
  );
  const data = await res.json();

  const runs = data.workflow_runs.slice(0, 10);

  const backend = runs.find(r => r.name.toLowerCase().includes("backend"));
  const frontend = runs.find(r => r.name.toLowerCase().includes("frontend"));

  return { backend, frontend, all: runs };
}