import { createCounterClient } from "@counter/contract";
import { API_URL } from "./env.ts";

export const api = createCounterClient(API_URL);
