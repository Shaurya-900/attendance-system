import { env } from "../env";
import { memoryRepo } from "./memory";
import { supabaseRepo } from "./supabase";
import type { Repo } from "./types";

export function getRepo(): Repo {
  return env.backend === "memory" ? memoryRepo : supabaseRepo;
}
