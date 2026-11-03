-- =====================================================================
-- Happy Fish : données de départ (catégories et suggestions)
-- À lancer après schema.sql. Peut être relancé sans risque : il ne touche
-- qu'aux modèles, copiés dans chaque nouveau duo à sa création.
-- =====================================================================

delete from public.default_suggestions;
delete from public.default_categories;

insert into public.default_categories (name, color, position) values
  ('Maison', '#3FA7F0', 1),
  ('Messages et admin', '#9B6BDF', 2),
  ('Sport', '#FF8C1A', 3),
  ('Santé et bien-être', '#2ECC71', 4),
  ('Travail', '#2770C9', 5),
  ('Couple', '#FF6FAE', 6),
  ('Perso', '#F2C66D', 7);

insert into public.default_suggestions (category_name, title, minutes) values
  ('Maison', 'Faire la vaisselle', 15),
  ('Maison', 'Ranger une pièce', 20),
  ('Maison', 'Lancer une machine', 10),
  ('Maison', 'Sortir les poubelles', 5),
  ('Messages et admin', 'Répondre à tous les messages en attente', 15),
  ('Messages et admin', 'Traiter un papier administratif', 30),
  ('Messages et admin', 'Payer une facture', 10),
  ('Sport', 'Séance de sport', 60),
  ('Sport', 'Marcher 30 minutes', 30),
  ('Sport', 'Étirements', 15),
  ('Santé et bien-être', 'Méditation', 10),
  ('Santé et bien-être', 'Se coucher avant 23 h', 5),
  ('Santé et bien-être', 'Boire 1,5 L d''eau', 5),
  ('Travail', 'Bloc de travail concentré', 90),
  ('Travail', 'Préparer la semaine', 20),
  ('Couple', 'Préparer un dîner ensemble', 60),
  ('Couple', 'Soirée sans écran', 60),
  ('Perso', 'Lire 20 minutes', 20),
  ('Perso', 'Appeler un proche', 15);
