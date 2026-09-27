import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { createProjectSchema, updateProjectSchema } from "@talasa/shared"
import type { AuthUser } from "../auth/middleware"
import { requireAuth } from "../auth/middleware"
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  runProject,
  updateProject,
} from "../services/projects"

export const projectsRouter = new Hono<{ Variables: { user: AuthUser } }>()

projectsRouter.use("*", requireAuth)

projectsRouter.get("/", async (c) => c.json(await listProjects(c.get("user").id)))

projectsRouter.post("/", zValidator("json", createProjectSchema), async (c) =>
  c.json(await createProject(c.get("user").id, c.req.valid("json")), 201),
)

projectsRouter.get("/:id", async (c) => {
  const project = await getProject(c.get("user").id, c.req.param("id"))
  return project ? c.json(project) : c.json({ error: "Not found" }, 404)
})

projectsRouter.patch("/:id", zValidator("json", updateProjectSchema), async (c) => {
  const project = await updateProject(c.get("user").id, c.req.param("id"), c.req.valid("json"))
  return project ? c.json(project) : c.json({ error: "Not found" }, 404)
})

projectsRouter.delete("/:id", async (c) => {
  const ok = await deleteProject(c.get("user").id, c.req.param("id"))
  return ok ? c.body(null, 204) : c.json({ error: "Not found" }, 404)
})

projectsRouter.post("/:id/run", async (c) => {
  const project = await runProject(c.get("user").id, c.req.param("id"))
  return project ? c.json(project) : c.json({ error: "Not found" }, 404)
})
