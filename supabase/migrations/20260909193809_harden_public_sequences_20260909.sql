-- Client roles only receive sequence access that the application needs.
revoke all on sequence public.feedback_reference_seq from anon, authenticated;
grant usage on sequence public.feedback_reference_seq to authenticated;

revoke all on sequence public.push_delivery_log_id_seq from anon, authenticated;
revoke all on sequence public.user_state_history_id_seq from anon, authenticated;
