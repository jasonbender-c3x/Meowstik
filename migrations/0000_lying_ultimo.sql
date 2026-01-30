CREATE TABLE "agent_activity_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" varchar NOT NULL,
	"activity_type" text NOT NULL,
	"platform" text NOT NULL,
	"resource_type" text,
	"resource_id" text,
	"resource_url" text,
	"action" text NOT NULL,
	"title" text,
	"metadata" jsonb,
	"success" boolean DEFAULT true NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_identities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"username" text,
	"agent_type" text NOT NULL,
	"permission_level" text DEFAULT 'full' NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"description" text,
	"github_signature" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_identities_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "agent_jobs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"priority" integer DEFAULT 5 NOT NULL,
	"parent_job_id" varchar,
	"dependencies" text[] DEFAULT '{}',
	"execution_mode" text DEFAULT 'sequential' NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"worker_id" varchar,
	"max_retries" integer DEFAULT 3,
	"retry_count" integer DEFAULT 0,
	"timeout" integer DEFAULT 300000,
	"scheduled_for" timestamp,
	"cron_expression" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"user_id" varchar
);
--> statement-breakpoint
CREATE TABLE "agent_workers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'gemini' NOT NULL,
	"status" text DEFAULT 'idle' NOT NULL,
	"current_job_id" varchar,
	"max_concurrency" integer DEFAULT 1,
	"active_jobs" integer DEFAULT 0,
	"last_heartbeat" timestamp DEFAULT now() NOT NULL,
	"consecutive_failures" integer DEFAULT 0,
	"total_jobs_processed" integer DEFAULT 0,
	"total_tokens_used" bigint DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" varchar,
	"draft_id" varchar,
	"type" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text,
	"size" bigint,
	"content" text,
	"path" text,
	"permissions" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "call_conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"call_sid" text NOT NULL,
	"from_number" text NOT NULL,
	"to_number" text NOT NULL,
	"chat_id" varchar,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"turn_count" integer DEFAULT 0 NOT NULL,
	"current_context" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"duration" integer,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "call_conversations_call_sid_unique" UNIQUE("call_sid")
);
--> statement-breakpoint
CREATE TABLE "call_turns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"turn_number" integer NOT NULL,
	"user_speech" text,
	"speech_confidence" text,
	"ai_response" text NOT NULL,
	"ai_response_audio" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"duration" integer
);
--> statement-breakpoint
CREATE TABLE "chats" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"user_id" varchar,
	"is_guest" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collaborative_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"host_user_id" varchar,
	"files" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_voice_enabled" boolean DEFAULT true NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"max_participants" integer DEFAULT 5,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "conversation_sources" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"title" text NOT NULL,
	"participants" text[],
	"message_count" integer DEFAULT 0,
	"date_start" timestamp,
	"date_end" timestamp,
	"status" text DEFAULT 'pending' NOT NULL,
	"content" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cross_references" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_type" text NOT NULL,
	"source_id" varchar NOT NULL,
	"target_type" text NOT NULL,
	"target_id" varchar NOT NULL,
	"relationship_type" text NOT NULL,
	"strength" integer DEFAULT 50,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cursor_positions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"participant_id" varchar NOT NULL,
	"file_path" text NOT NULL,
	"line" integer NOT NULL,
	"column" integer NOT NULL,
	"selection_start_line" integer,
	"selection_start_column" integer,
	"selection_end_line" integer,
	"selection_end_column" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_chunks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"attachment_id" varchar,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"embedding" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drafts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" varchar NOT NULL,
	"text_content" text DEFAULT '',
	"voice_transcript" text DEFAULT '',
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edit_operations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"participant_id" varchar NOT NULL,
	"file_path" text NOT NULL,
	"operation_type" text NOT NULL,
	"position" integer NOT NULL,
	"length" integer,
	"text" text,
	"base_version" integer NOT NULL,
	"result_version" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"aliases" text[],
	"description" text,
	"external_ids" jsonb,
	"mention_count" integer DEFAULT 0,
	"last_mentioned" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_mentions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" varchar NOT NULL,
	"evidence_id" varchar,
	"knowledge_id" varchar,
	"mention_text" text,
	"context" text,
	"sentiment" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text,
	"source_url" text,
	"modality" text NOT NULL,
	"mime_type" text,
	"title" text,
	"raw_content" text,
	"extracted_text" text,
	"summary" text,
	"author" text,
	"participants" text[],
	"language" text DEFAULT 'en',
	"word_count" integer,
	"user_id" varchar,
	"is_guest" boolean DEFAULT false NOT NULL,
	"content_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"processing_error" text,
	"bucket" text,
	"confidence" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "execution_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" varchar,
	"action" text NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"exit_code" text,
	"duration" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "executor_state" (
	"id" varchar PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"status" text DEFAULT 'stopped' NOT NULL,
	"current_task_id" varchar,
	"running_task_ids" text[],
	"tasks_processed" integer DEFAULT 0 NOT NULL,
	"tasks_failed" integer DEFAULT 0 NOT NULL,
	"last_activity_at" timestamp,
	"max_parallel_tasks" integer DEFAULT 3,
	"poll_interval_ms" integer DEFAULT 5000,
	"started_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extracted_knowledge" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" varchar,
	"job_id" varchar,
	"bucket" text NOT NULL,
	"section" text,
	"content" text NOT NULL,
	"confidence" integer DEFAULT 100,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" varchar,
	"chat_id" varchar,
	"rating" varchar(20),
	"categories" jsonb,
	"liked_aspects" text[],
	"disliked_aspects" text[],
	"freeform_text" text,
	"prompt_snapshot" text,
	"response_snapshot" text,
	"kernel_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"submitted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "google_oauth_tokens" (
	"id" varchar PRIMARY KEY DEFAULT 'default' NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"expiry_date" bigint,
	"token_type" text,
	"scope" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_jobs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" varchar,
	"source_name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"progress" integer DEFAULT 0,
	"messages_processed" integer DEFAULT 0,
	"total_messages" integer DEFAULT 0,
	"error" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_results" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar NOT NULL,
	"success" boolean NOT NULL,
	"output" jsonb,
	"error" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"duration_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "job_results_job_id_unique" UNIQUE("job_id")
);
--> statement-breakpoint
CREATE TABLE "kernel_evolutions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kernel_id" varchar NOT NULL,
	"chat_id" varchar,
	"message_id" varchar,
	"evolution_type" text NOT NULL,
	"target_section" text NOT NULL,
	"observation" text NOT NULL,
	"proposed_change" text NOT NULL,
	"rationale" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_at" timestamp,
	"applied_to_version" varchar,
	"confidence" integer DEFAULT 50,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kernels" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" text NOT NULL,
	"parent_id" varchar,
	"user_id" varchar,
	"core_directives" text NOT NULL,
	"personality" text,
	"learned_behaviors" text,
	"user_preferences" text,
	"tool_config" jsonb,
	"bucket_weights" jsonb,
	"status" text DEFAULT 'active' NOT NULL,
	"evolution_reason" text,
	"change_log" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_embeddings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evidence_id" varchar,
	"knowledge_id" varchar,
	"chunk_id" varchar,
	"content" text NOT NULL,
	"embedding" jsonb,
	"embedding_model" text DEFAULT 'text-embedding-004',
	"dimensions" integer DEFAULT 768,
	"bucket" text,
	"modality" text,
	"source_type" text,
	"user_id" varchar,
	"is_guest" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "llm_interactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" varchar,
	"message_id" varchar,
	"user_id" varchar,
	"system_prompt" text,
	"user_message" text,
	"conversation_history" jsonb,
	"attachments" jsonb,
	"rag_context" jsonb,
	"injected_files" jsonb,
	"injected_json" jsonb,
	"raw_response" text,
	"clean_content" text,
	"parsed_tool_calls" jsonb,
	"tool_results" jsonb,
	"model" varchar(100),
	"duration_ms" integer,
	"token_estimate" jsonb,
	"error" text,
	"status" varchar(20) DEFAULT 'success' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "llm_usage" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" varchar,
	"message_id" varchar,
	"model" text NOT NULL,
	"prompt_tokens" integer NOT NULL,
	"completion_tokens" integer NOT NULL,
	"total_tokens" integer NOT NULL,
	"duration_ms" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" varchar NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb,
	"gemini_content" jsonb
);
--> statement-breakpoint
CREATE TABLE "queued_tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" varchar,
	"chat_id" varchar,
	"title" text NOT NULL,
	"description" text,
	"task_type" text NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"error" text,
	"execution_mode" text DEFAULT 'sequential' NOT NULL,
	"condition" text,
	"condition_result" boolean,
	"dependencies" text[],
	"waiting_for_input" boolean DEFAULT false NOT NULL,
	"input_prompt" text,
	"operator_input" text,
	"workflow_id" varchar,
	"estimated_duration" integer,
	"actual_duration" integer,
	"retry_count" integer DEFAULT 0,
	"max_retries" integer DEFAULT 3,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "rag_chunk_lineage" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chunk_id" varchar(255) NOT NULL,
	"document_id" varchar(255) NOT NULL,
	"source_type" varchar(100) NOT NULL,
	"source_id" varchar(255) NOT NULL,
	"filename" varchar(500),
	"ingested_at" timestamp DEFAULT now() NOT NULL,
	"ingestion_trace_id" varchar(255),
	"content_preview" text,
	"content_length" integer,
	"chunk_index" integer,
	"embedding_model" varchar(100),
	"vector_store" varchar(100),
	"retrieval_count" integer DEFAULT 0,
	"last_retrieved_at" timestamp,
	"avg_similarity_score" varchar(20),
	"importance_score" varchar(20),
	"is_verified" boolean DEFAULT false,
	"tags" text[],
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rag_chunk_lineage_chunk_id_unique" UNIQUE("chunk_id")
);
--> statement-breakpoint
CREATE TABLE "rag_metrics_hourly" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hour_start" timestamp NOT NULL,
	"documents_ingested" integer DEFAULT 0,
	"chunks_created" integer DEFAULT 0,
	"chunks_filtered" integer DEFAULT 0,
	"avg_ingestion_duration_ms" integer,
	"queries_processed" integer DEFAULT 0,
	"avg_query_duration_ms" integer,
	"avg_search_results" integer,
	"avg_context_tokens" integer,
	"avg_similarity_score" varchar(20),
	"empty_result_count" integer DEFAULT 0,
	"error_count" integer DEFAULT 0,
	"embedding_api_calls" integer DEFAULT 0,
	"vector_search_operations" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rag_metrics_hourly_hour_start_unique" UNIQUE("hour_start")
);
--> statement-breakpoint
CREATE TABLE "rag_retrieval_results" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trace_id" varchar(255) NOT NULL,
	"query_text" text NOT NULL,
	"user_id" varchar(255),
	"chat_id" varchar(255),
	"chunk_id" varchar(255) NOT NULL,
	"similarity_score" varchar(20) NOT NULL,
	"rank" integer NOT NULL,
	"included_in_context" boolean DEFAULT false,
	"context_position" integer,
	"was_relevant" boolean,
	"feedback_source" varchar(50),
	"retrieved_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rag_traces" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trace_id" varchar(255) NOT NULL,
	"trace_type" varchar(50) NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"duration_ms" integer,
	"stage" varchar(50) NOT NULL,
	"document_id" varchar(255),
	"chunk_ids" text[],
	"message_id" varchar(255),
	"chat_id" varchar(255),
	"user_id" varchar(255),
	"query_text" text,
	"query_length" integer,
	"filename" varchar(500),
	"content_type" varchar(100),
	"content_length" integer,
	"chunks_created" integer,
	"chunks_filtered" integer,
	"chunking_strategy" varchar(50),
	"embedding_model" varchar(100),
	"embedding_dimensions" integer,
	"search_results" integer,
	"threshold" varchar(20),
	"top_k" integer,
	"scores" text[],
	"tokens_used" integer,
	"sources_count" integer,
	"context_length" integer,
	"error_message" text,
	"error_stage" varchar(50),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"cron_expression" text NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"task_template" jsonb NOT NULL,
	"workflow_id" varchar,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp,
	"next_run_at" timestamp,
	"run_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"consecutive_failures" integer DEFAULT 0,
	"max_consecutive_failures" integer DEFAULT 3,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_participants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"user_id" varchar,
	"participant_type" text DEFAULT 'user' NOT NULL,
	"display_name" text NOT NULL,
	"avatar_color" text DEFAULT '#4285f4',
	"can_edit" boolean DEFAULT true NOT NULL,
	"can_voice" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"left_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_sid" varchar NOT NULL,
	"account_sid" varchar NOT NULL,
	"from" varchar NOT NULL,
	"to" varchar NOT NULL,
	"body" text NOT NULL,
	"direction" varchar(20) NOT NULL,
	"status" varchar(50) NOT NULL,
	"num_media" integer DEFAULT 0,
	"media_urls" jsonb,
	"processed" boolean DEFAULT false NOT NULL,
	"chat_id" varchar,
	"response_message_sid" varchar,
	"error_code" integer,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	CONSTRAINT "sms_messages_message_sid_unique" UNIQUE("message_sid")
);
--> statement-breakpoint
CREATE TABLE "ssh_hosts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alias" text NOT NULL,
	"hostname" text NOT NULL,
	"port" integer DEFAULT 22 NOT NULL,
	"username" text NOT NULL,
	"key_secret_name" text,
	"password_secret_name" text,
	"last_connected" timestamp,
	"last_error" text,
	"description" text,
	"tags" text[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ssh_hosts_alias_unique" UNIQUE("alias")
);
--> statement-breakpoint
CREATE TABLE "ssh_keys" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"public_key" text NOT NULL,
	"private_key_secret_name" text NOT NULL,
	"key_type" text DEFAULT 'ed25519' NOT NULL,
	"fingerprint" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ssh_keys_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "todo_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"category" text,
	"tags" text[],
	"related_chat_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "tool_call_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" varchar NOT NULL,
	"message_id" varchar,
	"tool_call_id" text NOT NULL,
	"tool_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"request" jsonb NOT NULL,
	"response" jsonb,
	"error_message" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"duration" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" varchar NOT NULL,
	"task_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"result" jsonb,
	"error" text,
	"executed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "triggers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"trigger_type" text NOT NULL,
	"pattern" text,
	"sender_filter" text,
	"subject_filter" text,
	"task_template" jsonb,
	"workflow_id" varchar,
	"priority" integer DEFAULT 5 NOT NULL,
	"webhook_secret" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_triggered_at" timestamp,
	"trigger_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_agents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"display_name" varchar NOT NULL,
	"description" text,
	"agent_type" varchar DEFAULT 'assistant' NOT NULL,
	"avatar_url" text,
	"brand_color" varchar DEFAULT '#4285f4',
	"personality_prompt" text,
	"system_prompt_overrides" text,
	"github_signature" text,
	"email_signature" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"canonical_domain" varchar,
	"tags" text[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_branding" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"agent_name" varchar DEFAULT 'Meowstik' NOT NULL,
	"display_name" varchar DEFAULT 'Meowstik AI' NOT NULL,
	"avatar_url" text,
	"brand_color" varchar DEFAULT '#4285f4',
	"github_signature" text,
	"email_signature" text,
	"canonical_domain" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_branding_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "workflows" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"steps" jsonb NOT NULL,
	"default_execution_mode" text DEFAULT 'sequential' NOT NULL,
	"max_parallel_tasks" integer DEFAULT 3,
	"timeout_seconds" integer DEFAULT 3600,
	"enabled" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_activity_log" ADD CONSTRAINT "agent_activity_log_agent_id_agent_identities_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent_identities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_jobs" ADD CONSTRAINT "agent_jobs_parent_job_id_agent_jobs_id_fk" FOREIGN KEY ("parent_job_id") REFERENCES "public"."agent_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_workers" ADD CONSTRAINT "agent_workers_current_job_id_agent_jobs_id_fk" FOREIGN KEY ("current_job_id") REFERENCES "public"."agent_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_draft_id_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_conversations" ADD CONSTRAINT "call_conversations_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_turns" ADD CONSTRAINT "call_turns_conversation_id_call_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."call_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaborative_sessions" ADD CONSTRAINT "collaborative_sessions_host_user_id_users_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cursor_positions" ADD CONSTRAINT "cursor_positions_session_id_collaborative_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."collaborative_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cursor_positions" ADD CONSTRAINT "cursor_positions_participant_id_session_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."session_participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_attachment_id_attachments_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."attachments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edit_operations" ADD CONSTRAINT "edit_operations_session_id_collaborative_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."collaborative_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edit_operations" ADD CONSTRAINT "edit_operations_participant_id_session_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."session_participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_mentions" ADD CONSTRAINT "entity_mentions_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_mentions" ADD CONSTRAINT "entity_mentions_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_mentions" ADD CONSTRAINT "entity_mentions_knowledge_id_extracted_knowledge_id_fk" FOREIGN KEY ("knowledge_id") REFERENCES "public"."extracted_knowledge"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_logs" ADD CONSTRAINT "execution_logs_task_id_tool_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tool_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracted_knowledge" ADD CONSTRAINT "extracted_knowledge_source_id_conversation_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."conversation_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracted_knowledge" ADD CONSTRAINT "extracted_knowledge_job_id_ingestion_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."ingestion_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_jobs" ADD CONSTRAINT "ingestion_jobs_source_id_conversation_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."conversation_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_results" ADD CONSTRAINT "job_results_job_id_agent_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."agent_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kernel_evolutions" ADD CONSTRAINT "kernel_evolutions_kernel_id_kernels_id_fk" FOREIGN KEY ("kernel_id") REFERENCES "public"."kernels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kernel_evolutions" ADD CONSTRAINT "kernel_evolutions_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kernel_evolutions" ADD CONSTRAINT "kernel_evolutions_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kernels" ADD CONSTRAINT "kernels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_embeddings" ADD CONSTRAINT "knowledge_embeddings_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_embeddings" ADD CONSTRAINT "knowledge_embeddings_knowledge_id_extracted_knowledge_id_fk" FOREIGN KEY ("knowledge_id") REFERENCES "public"."extracted_knowledge"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_embeddings" ADD CONSTRAINT "knowledge_embeddings_chunk_id_document_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."document_chunks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_embeddings" ADD CONSTRAINT "knowledge_embeddings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_interactions" ADD CONSTRAINT "llm_interactions_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_interactions" ADD CONSTRAINT "llm_interactions_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_interactions" ADD CONSTRAINT "llm_interactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_usage" ADD CONSTRAINT "llm_usage_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_usage" ADD CONSTRAINT "llm_usage_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queued_tasks" ADD CONSTRAINT "queued_tasks_parent_id_queued_tasks_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."queued_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queued_tasks" ADD CONSTRAINT "queued_tasks_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_session_id_collaborative_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."collaborative_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_items" ADD CONSTRAINT "todo_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_items" ADD CONSTRAINT "todo_items_related_chat_id_chats_id_fk" FOREIGN KEY ("related_chat_id") REFERENCES "public"."chats"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_call_logs" ADD CONSTRAINT "tool_call_logs_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_call_logs" ADD CONSTRAINT "tool_call_logs_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_tasks" ADD CONSTRAINT "tool_tasks_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_agents" ADD CONSTRAINT "user_agents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_branding" ADD CONSTRAINT "user_branding_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agent_activity_agent" ON "agent_activity_log" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_agent_activity_type" ON "agent_activity_log" USING btree ("activity_type");--> statement-breakpoint
CREATE INDEX "idx_agent_activity_platform" ON "agent_activity_log" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "idx_agent_jobs_status" ON "agent_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_agent_jobs_priority" ON "agent_jobs" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_agent_jobs_parent" ON "agent_jobs" USING btree ("parent_job_id");--> statement-breakpoint
CREATE INDEX "idx_agent_jobs_scheduled" ON "agent_jobs" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "idx_agent_workers_status" ON "agent_workers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_agent_workers_heartbeat" ON "agent_workers" USING btree ("last_heartbeat");--> statement-breakpoint
CREATE INDEX "idx_call_conversations_sid" ON "call_conversations" USING btree ("call_sid");--> statement-breakpoint
CREATE INDEX "idx_call_conversations_status" ON "call_conversations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_call_turns_conversation" ON "call_turns" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_call_turns_number" ON "call_turns" USING btree ("conversation_id","turn_number");--> statement-breakpoint
CREATE INDEX "idx_edit_ops_session" ON "edit_operations" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_edit_ops_version" ON "edit_operations" USING btree ("session_id","base_version");--> statement-breakpoint
CREATE INDEX "idx_job_results_job" ON "job_results" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_chunk_lineage_document" ON "rag_chunk_lineage" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_chunk_lineage_source" ON "rag_chunk_lineage" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "idx_retrieval_trace" ON "rag_retrieval_results" USING btree ("trace_id");--> statement-breakpoint
CREATE INDEX "idx_retrieval_chunk" ON "rag_retrieval_results" USING btree ("chunk_id");--> statement-breakpoint
CREATE INDEX "idx_rag_traces_trace_id" ON "rag_traces" USING btree ("trace_id");--> statement-breakpoint
CREATE INDEX "idx_rag_traces_timestamp" ON "rag_traces" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_rag_traces_type_stage" ON "rag_traces" USING btree ("trace_type","stage");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "idx_todo_items_user" ON "todo_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_todo_items_status" ON "todo_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_todo_items_priority" ON "todo_items" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_tool_call_logs_chat" ON "tool_call_logs" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "idx_tool_call_logs_message" ON "tool_call_logs" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "idx_tool_call_logs_status" ON "tool_call_logs" USING btree ("status");