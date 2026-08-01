# Tiny one-shot image that owns database provisioning.
#
# It needs exactly three things: psql to apply migrations, curl to talk to the
# GoTrue admin API when seeding users, and bash for the runner script. The
# postgres alpine image already ships a psql matching the server version, which
# avoids client/server mismatch warnings.
#
# Migrations, seeds and the runner script are bind-mounted at run time rather
# than copied in, so iterating on SQL does not require an image rebuild.
FROM postgres:15-alpine

RUN apk add --no-cache bash curl

WORKDIR /supabase

ENTRYPOINT ["bash", "/supabase/scripts/migrate.sh"]
