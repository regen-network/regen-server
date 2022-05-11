CREATE OR REPLACE FUNCTION get_available_credits (vintage_id uuid)
    RETURNS numeric
    AS $$
DECLARE
    v_available_credits numeric;
BEGIN
    SELECT
        available_credits
    FROM
        get_available_credits_record (vintage_id) INTO v_available_credits AS (
available_credits numeric,
        initial_distribution jsonb,
        credit_class_id uuid,
        developer_id uuid,
        land_owner_id uuid,
        steward_id uuid,
        developer_wallet_id uuid,
        land_owner_wallet_id uuid,
        steward_wallet_id uuid,
        project jsonb,
        reseller_id uuid);
    RETURN v_available_credits;
END;
$$
LANGUAGE plpgsql
STABLE SET search_path = pg_catalog, public, pg_temp;

CREATE OR REPLACE FUNCTION get_available_credits_record (vintage_id uuid)
    RETURNS RECORD
    AS $$
DECLARE
    result_record RECORD;
    v_credit_vintage credit_vintage;
    v_project project;
    v_developer_wallet_id uuid;
    v_land_owner_wallet_id uuid;
    v_steward_wallet_id uuid;
    v_available_credits numeric;
    v_project_location address;
BEGIN
    -- get credit vintage
    SELECT
        * INTO v_credit_vintage
    FROM
        credit_vintage
    WHERE
        id = vintage_id;
    IF v_credit_vintage.id IS NULL THEN
        RAISE EXCEPTION 'Credit vintage not found'
            USING errcode = 'NTFND';
        END IF;
        -- get project
        SELECT
            * INTO v_project
        FROM
            project
        WHERE
            id = v_credit_vintage.project_id;
        IF v_project.id IS NULL THEN
            RAISE EXCEPTION 'Project not found'
                USING errcode = 'NTFND';
            END IF;
            -- get wallet ids of project's stakeholders
            v_developer_wallet_id := public.get_wallet_id(v_project.developer_id);
            v_land_owner_wallet_id := public.get_wallet_id(v_project.land_owner_id);
            v_steward_wallet_id := public.get_wallet_id(v_project.steward_id);

            SELECT
                sum(liquid_balance) INTO v_available_credits
            FROM
                account_balance
            WHERE (wallet_id = v_developer_wallet_id
                OR wallet_id = v_land_owner_wallet_id
                OR wallet_id = v_steward_wallet_id)
                AND credit_vintage_id = vintage_id;

            -- project location
            SELECT
                *
            FROM
                address INTO v_project_location
            WHERE
                id = v_project.address_id;
            SELECT
                v_available_credits,
                v_credit_vintage.initial_distribution,
                v_credit_vintage.credit_class_id,
                v_project.developer_id,
                v_project.land_owner_id,
                v_project.steward_id,
                v_developer_wallet_id,
                v_land_owner_wallet_id,
                v_steward_wallet_id,
                jsonb_build_object('metadata', v_project.metadata),
                v_credit_vintage.reseller_id INTO result_record;
            RETURN result_record;
END;
$$
LANGUAGE plpgsql
VOLATILE SET search_path = pg_catalog, public, pg_temp;
