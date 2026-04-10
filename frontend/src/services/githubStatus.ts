/**
 * Service to fetch the latest GitHub Actions workflow runs for the MeroSadak repository.
 */
export async function fetchDeployStatus() {
  try {
    const res = await fetch(
      "https://api.github.com/repos/banjais/merosadak/actions/runs"
    );
    
    if (!res.ok) throw new Error("Failed to fetch from GitHub API");
    
    const data = await res.json();
    const runs = data.workflow_runs.slice(0, 10);

    // Identify runs based on name or branch patterns
    // We assume backend runs have 'backend' in name and frontend has 'frontend'
    const backend = runs.find((r: any) => 
      r.name.toLowerCase().includes("backend") || 
      r.display_title.toLowerCase().includes("backend")
    );
    
    const frontend = runs.find((r: any) => 
      r.name.toLowerCase().includes("frontend") || 
      r.display_title.toLowerCase().includes("frontend")
    );

    return { 
      backend, 
      frontend, 
      all: runs 
    };
  } catch (err) {
    console.error("[githubStatus] Error:", err);
    return { backend: null, frontend: null, all: [] };
  }
}
