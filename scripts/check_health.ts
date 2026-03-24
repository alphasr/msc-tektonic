
import { checkStorageHealth } from "../lib/health";
import { initStorage } from "../lib/storage";

async function run() {
  console.log("Checking storage health...");
  try {
    const health = await checkStorageHealth();
    console.log("Storage health:", JSON.stringify(health, null, 2));
    
    if (health.status !== "operational") {
        console.log("Attempting to init storage...");
        await initStorage();
        const health2 = await checkStorageHealth();
        console.log("Storage health after init:", JSON.stringify(health2, null, 2));
    }
  } catch (err) {
    console.error("Error running check:", err);
  }
}

run();
