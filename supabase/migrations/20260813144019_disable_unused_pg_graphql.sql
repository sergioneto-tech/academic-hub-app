-- Academic Hub: GraphQL não é utilizado pela aplicação.
-- Remove a extensão para reduzir a superfície de exposição/introspeção.
drop extension if exists pg_graphql;
