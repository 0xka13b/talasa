import { and, desc, eq } from "drizzle-orm"
import type { CreateProjectInput, UpdateProjectInput } from "@talasa/shared"
import { db, projects } from "@talasa/db"

export function listProjects(userId: string) {
  return db.select().from(projects).where(eq(projects.createdBy, userId)).orderBy(desc(projects.createdAt))
}

export async function getProject(userId: string, id: string) {
  const [row] = await db.select().from(projects).where(and(eq(projects.id, id), eq(projects.createdBy, userId)))
  return row ?? null
}

export async function createProject(userId: string, input: CreateProjectInput) {
  const { name: inputName, ...rest } = input
  const name = inputName?.trim() || input.counterpartyName
  const [row] = await db.insert(projects).values({ ...rest, name, createdBy: userId }).returning()
  if (!row) throw new Error("Insert did not return a row")
  return row
}

export async function updateProject(userId: string, id: string, input: UpdateProjectInput) {
  const { name: inputName, ...rest } = input
  const setValues = inputName !== undefined
    ? { ...rest, name: inputName?.trim() || undefined, updatedAt: new Date() }
    : { ...rest, updatedAt: new Date() }
  const [row] = await db
    .update(projects)
    .set(setValues)
    .where(and(eq(projects.id, id), eq(projects.createdBy, userId)))
    .returning()
  return row ?? null
}

export async function deleteProject(userId: string, id: string) {
  const [row] = await db
    .delete(projects)
    .where(and(eq(projects.id, id), eq(projects.createdBy, userId)))
    .returning({ id: projects.id })
  return Boolean(row)
}

export async function runProject(userId: string, id: string) {
  const [row] = await db
    .update(projects)
    .set({ status: "queued", error: null, brief: null, resolved: null, steps: {}, progress: null, modelMeta: null, startedAt: null, finishedAt: null, updatedAt: new Date() })
    .where(and(eq(projects.id, id), eq(projects.createdBy, userId)))
    .returning()
  return row ?? null
}
