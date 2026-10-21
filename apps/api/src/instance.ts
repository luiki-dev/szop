import { randomBytes } from "node:crypto";

// Names this process, so /api/health and the startup log tell the tasks
// behind the load balancer apart. Random, not an address, and new on every
// start, so a public route reveals nothing by showing it (PH-37 spec,
// decision 3).
export const instanceId: string = randomBytes(4).toString("hex");
