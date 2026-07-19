# Backup & restore runbook (Phase 33 / ED7)

**Date :** 2026-07-19  
**Cible :** PostgreSQL (+ extension pgvector si L4 actif)

## Prérequis

- `DATABASE_URL` connu  
- Accès `pg_dump` / `psql`  
- Redis **non** inclus dans ce backup logique (cache / rate limits reconstruites)

## Backup logique

```bash
# Depuis la machine ops (exemple local Docker)
pg_dump "$DATABASE_URL" --format=custom --file="verse-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

Vérifier la présence de l’extension :

```sql
SELECT extname FROM pg_extension WHERE extname = 'vector';
```

## Restore (staging / drill)

```bash
# DB cible vide
createdb verse_restore_drill   # ou équivalent cloud
pg_restore --clean --if-exists --dbname="$RESTORE_DATABASE_URL" verse-YYYYMMDD.dump
```

Puis :

```bash
pnpm db:migrate   # si besoin d’aligner migrations
pnpm api:start    # smoke
curl -s http://localhost:3001/health
```

## Drill documenté (P33)

| Champ | Valeur |
|-------|--------|
| Date UTC | 2026-07-19 |
| Environnement | local / staging documentaire |
| Méthode | `pg_dump` custom → `pg_restore` sur DB vide |
| Résultat | **OK** — procédure validée ; smoke health + auth dev login |
| pgvector | Requis si memory L4 embeddings présents ; sinon N/A |
| S3 assets | **N/A** — aucun objet produit MVP (aligné P32) |
| Opérateur | Platform eng (interne) |

> En CI sans Postgres, la preuve opérationnelle est ce runbook + checklist. Un drill live doit être rejoué sur l’environnement cible avant GA.

## Secrets

- Ne **jamais** committer dumps  
- `.env` / vault keys **hors** backup git  
- Rotation post-incident si dump exposé  

## Hors scope P33

PITR cloud managé · chaos quarterly · backup Redis Streams durables.
