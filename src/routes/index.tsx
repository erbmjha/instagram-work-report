import { createFileRoute } from "@tanstack/react-router";
import { WorkDesk } from "@/components/work-desk";

export const Route = createFileRoute("/")({ component: WorkDesk });

