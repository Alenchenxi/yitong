DROP INDEX IF EXISTS "tutor_job_sync_bindings_source_source_active_idx";

CREATE INDEX "tutor_job_sync_bindings_source_source_active_id_idx"
  ON "tutor_job_sync_bindings"("source", "source_active", "id");
