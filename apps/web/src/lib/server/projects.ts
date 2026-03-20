import sql from './db';
import type { Project, ProjectMilestone, ProjectTask } from '$lib/types/project';
import type { InterviewDocument } from '$lib/types/interview';
import type { EstimateResult, Milestone as EstimateMilestone } from '$lib/types/estimate';

export async function createProjectFromEstimate(
	estimateId: string,
	userId: string,
	name: string,
	result: EstimateResult,
	scenarioName: string = 'moderado'
): Promise<Project> {
	const scenario = result.cost_scenarios.find((s) => s.name === scenarioName) ??
		result.cost_scenarios[0];

	const [project] = await sql<Project[]>`
		INSERT INTO public.projects (
			estimate_id, user_id, name, description,
			selected_scenario, total_cost, total_hours, duration_weeks, team_size
		)
		VALUES (
			${estimateId}, ${userId}, ${name}, ${result.summary ?? null},
			${scenario?.name ?? 'moderado'},
			${scenario?.total_cost ?? null},
			${scenario?.total_hours ?? null},
			${scenario?.duration_weeks ?? null},
			${scenario?.team_size ?? null}
		)
		RETURNING *
	`;

	// Create milestones from estimate
	if (result.milestones?.length > 0) {
		await createMilestonesFromEstimate(project.id, result.milestones);
	}

	return project;
}

async function createMilestonesFromEstimate(
	projectId: string,
	milestones: EstimateMilestone[]
): Promise<void> {
	for (let i = 0; i < milestones.length; i++) {
		const m = milestones[i];
		await sql`
			INSERT INTO public.milestones (
				project_id, name, description, duration_weeks,
				sort_order, deliverables, dependencies
			)
			VALUES (
				${projectId}, ${m.name}, ${m.description},
				${m.duration_weeks}, ${i},
				${sql.json(m.deliverables)}, ${sql.json(m.dependencies)}
			)
		`;
	}
}

export async function getProject(
	projectId: string,
	userId: string
): Promise<Project | null> {
	const [row] = await sql<Project[]>`
		SELECT * FROM public.projects
		WHERE id = ${projectId} AND user_id = ${userId}
	`;
	return row ?? null;
}

export async function getProjectsByUser(userId: string): Promise<Project[]> {
	return sql<Project[]>`
		SELECT * FROM public.projects
		WHERE user_id = ${userId}
		ORDER BY created_at DESC
	`;
}

export async function getProjectByEstimate(
	estimateId: string,
	userId: string
): Promise<Project | null> {
	const [row] = await sql<Project[]>`
		SELECT * FROM public.projects
		WHERE estimate_id = ${estimateId} AND user_id = ${userId}
		LIMIT 1
	`;
	return row ?? null;
}

export async function updateProjectStatus(
	projectId: string,
	status: string
): Promise<void> {
	await sql`
		UPDATE public.projects
		SET status = ${status}
		WHERE id = ${projectId}
	`;
}

export async function getMilestones(projectId: string): Promise<ProjectMilestone[]> {
	return sql<ProjectMilestone[]>`
		SELECT * FROM public.milestones
		WHERE project_id = ${projectId}
		ORDER BY sort_order ASC
	`;
}

export async function updateMilestoneStatus(
	milestoneId: string,
	status: string
): Promise<void> {
	const now = status === 'in_progress' ? 'started_at' : status === 'done' ? 'completed_at' : null;

	if (now === 'started_at') {
		await sql`
			UPDATE public.milestones
			SET status = ${status}, started_at = now()
			WHERE id = ${milestoneId} AND started_at IS NULL
		`;
	} else if (now === 'completed_at') {
		await sql`
			UPDATE public.milestones
			SET status = ${status}, completed_at = now()
			WHERE id = ${milestoneId}
		`;
	} else {
		await sql`
			UPDATE public.milestones
			SET status = ${status}
			WHERE id = ${milestoneId}
		`;
	}
}

export async function getTasks(projectId: string): Promise<ProjectTask[]> {
	return sql<ProjectTask[]>`
		SELECT * FROM public.tasks
		WHERE project_id = ${projectId}
		ORDER BY sort_order ASC
	`;
}

export async function getTasksByMilestone(milestoneId: string): Promise<ProjectTask[]> {
	return sql<ProjectTask[]>`
		SELECT * FROM public.tasks
		WHERE milestone_id = ${milestoneId}
		ORDER BY sort_order ASC
	`;
}

export async function createTask(
	milestoneId: string,
	projectId: string,
	title: string,
	description?: string,
	estimatedHours?: number,
	priority: string = 'medium'
): Promise<ProjectTask> {
	const [row] = await sql<ProjectTask[]>`
		INSERT INTO public.tasks (
			milestone_id, project_id, title, description, estimated_hours, priority,
			sort_order
		)
		VALUES (
			${milestoneId}, ${projectId}, ${title}, ${description ?? null},
			${estimatedHours ?? null}, ${priority},
			(SELECT COALESCE(MAX(sort_order), -1) + 1 FROM public.tasks WHERE milestone_id = ${milestoneId})
		)
		RETURNING *
	`;
	return row;
}

export async function getProjectDocuments(projectId: string): Promise<InterviewDocument[]> {
	return sql<InterviewDocument[]>`
		SELECT d.*
		FROM public.documents d
		JOIN public.estimates e ON e.interview_id = d.interview_id
		JOIN public.projects p ON p.estimate_id = e.id
		WHERE p.id = ${projectId}
		ORDER BY d.created_at ASC
	`;
}

export async function updateTaskStatus(
	taskId: string,
	status: string
): Promise<void> {
	await sql`
		UPDATE public.tasks
		SET status = ${status}
		WHERE id = ${taskId}
	`;
}
