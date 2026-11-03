# Migrations

Chaque évolution de la base après la mise en route arrive ici, dans un fichier numéroté
(`002_boutique.sql`, `003_…`). À coller dans le SQL Editor de Supabase, puis **Run**,
une seule fois, dans l'ordre des numéros.

Chaque fichier commence par vérifier qu'il n'a pas déjà été appliqué (table `schema_migrations`),
et s'arrête sans rien changer s'il l'a été.

`001_init` correspond à `schema.sql` : déjà appliqué à la mise en route.
