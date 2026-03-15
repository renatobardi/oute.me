export interface Project {
	id: string;
	estimate_id: string;
	user_id: string;
	name: string;
	description: string | null;
	status: string;
	selected_scenario: string;
	total_cost: number | null;
	total_hours: number | null;
	duration_weeks: number | null;
	team_size: number | null;
	created_at: Date;
	updated_at: Date;
}

export interface ProjectMilestone {
	id: string;
	project_id: string;
	name: string;
	description: string | null;
	duration_weeks: number;
	sort_order: number;
	status: string;
	deliverables: string[];
	dependencies: string[];
	started_at: Date | null;
	completed_at: Date | null;
	created_at: Date;
	updated_at: Date;
}

export interface ProjectTask {
	id: string;
	milestone_id: string;
	project_id: string;
	title: string;
	description: string | null;
	status: string;
	priority: string;
	estimated_hours: number | null;
	sort_order: number;
	created_at: Date;
	updated_at: Date;
}
