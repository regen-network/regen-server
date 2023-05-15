import { pgTable, pgEnum, pgSchema, AnyPgColumn, integer, text, varchar, uuid, timestamp, jsonb, uniqueIndex, foreignKey, primaryKey, index, numeric, char, boolean } from "drizzle-orm/pg-core"

export const projectState = pgEnum("project_state", ['proposed', 'pending_approval', 'active', 'hold', 'ended'])
export const partyType = pgEnum("party_type", ['user', 'organization'])
export const transactionState = pgEnum("transaction_state", ['hold', 'processing', 'succeeded', 'payment_failed', 'revoked'])
export const purchaseType = pgEnum("purchase_type", ['stripe_invoice', 'stripe_checkout', 'offline'])

import { sql } from "drizzle-orm"

export const geographyColumns = pgTable("geography_columns", {
	// TODO: failed to parse database type 'name'
	fTableCatalog: unknown("f_table_catalog"),
	// TODO: failed to parse database type 'name'
	fTableSchema: unknown("f_table_schema"),
	// TODO: failed to parse database type 'name'
	fTableName: unknown("f_table_name"),
	// TODO: failed to parse database type 'name'
	fGeographyColumn: unknown("f_geography_column"),
	coordDimension: integer("coord_dimension"),
	srid: integer("srid"),
	type: text("type"),
});

export const geometryColumns = pgTable("geometry_columns", {
	fTableCatalog: varchar("f_table_catalog", { length: 256 }),
	// TODO: failed to parse database type 'name'
	fTableSchema: unknown("f_table_schema"),
	// TODO: failed to parse database type 'name'
	fTableName: unknown("f_table_name"),
	// TODO: failed to parse database type 'name'
	fGeometryColumn: unknown("f_geometry_column"),
	coordDimension: integer("coord_dimension"),
	srid: integer("srid"),
	type: varchar("type", { length: 30 }),
});

export const account = pgTable("account", {
	id: uuid("id").default(sql`uuid_generate_v1()`).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	nonce: text("nonce").default(md5(gen_random_bytes(256))).notNull(),
});

export const shaclGraph = pgTable("shacl_graph", {
	uri: text("uri").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	graph: jsonb("graph").notNull(),
});

export const metadataGraph = pgTable("metadata_graph", {
	iri: text("iri").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	metadata: jsonb("metadata").notNull(),
});

export const wallet = pgTable("wallet", {
	id: uuid("id").default(sql`uuid_generate_v1()`).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	addr: text("addr").notNull(),
},
(table) => {
	return {
		addrKey: uniqueIndex("wallet_addr_key").on(table.addr),
	}
});

export const creditClass = pgTable("credit_class", {
	id: uuid("id").default(sql`uuid_generate_v1()`).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	uri: text("uri").default('').notNull(),
	onChainId: text("on_chain_id"),
},
(table) => {
	return {
		onChainIdKey: uniqueIndex("credit_class_on_chain_id_key").on(table.onChainId),
		uriKey: uniqueIndex("credit_class_uri_key").on(table.uri),
	}
});

export const creditClassVersion = pgTable("credit_class_version", {
	id: uuid("id").default(sql`uuid_generate_v1()`).notNull().references(() => creditClass.id),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text("name").notNull(),
	metadata: jsonb("metadata"),
},
(table) => {
	return {
		creditClassVersionPkey: primaryKey(table.id, table.createdAt)
	}
});

export const spatialRefSys = pgTable("spatial_ref_sys", {
	srid: integer("srid").notNull(),
	authName: varchar("auth_name", { length: 256 }),
	authSrid: integer("auth_srid"),
	srtext: varchar("srtext", { length: 2048 }),
	proj4Text: varchar("proj4text", { length: 2048 }),
});

export const creditBatch = pgTable("credit_batch", {
	id: uuid("id").default(sql`uuid_generate_v1()`).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	projectId: uuid("project_id").references(() => project.id),
	units: numeric("units"),
	creditClassVersionId: uuid("credit_class_version_id"),
	creditClassVersionCreatedAt: timestamp("credit_class_version_created_at", { withTimezone: true, mode: 'string' }),
	metadata: jsonb("metadata"),
	batchDenom: text("batch_denom"),
},
(table) => {
	return {
		batchDenomKey: uniqueIndex("credit_batch_batch_denom_key").on(table.batchDenom),
		creditClassVersionIdCreditClassVersionIdx: index("credit_batch_credit_class_version_id_credit_class_version_idx").on(table.creditClassVersionId, table.creditClassVersionCreatedAt),
		projectIdIdx: index("credit_batch_project_id_idx").on(table.projectId),
		creditBatchCreditClassVersionIdCreditClassVersioFkey: foreignKey({
			columns: [table.creditClassVersionId, table.creditClassVersionCreatedAt],
			foreignColumns: [creditClassVersion.id, creditClassVersion.createdAt]
		}),
	}
});

export const document = pgTable("document", {
	id: uuid("id").default(sql`uuid_generate_v1()`).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text("name").notNull(),
	type: text("type").notNull(),
	date: timestamp("date", { withTimezone: true, mode: 'string' }).notNull(),
	url: text("url").notNull(),
	projectId: uuid("project_id").references(() => project.id),
},
(table) => {
	return {
		projectIdIdx: index("document_project_id_idx").on(table.projectId),
	}
});

export const organization = pgTable("organization", {
	id: uuid("id").default(sql`uuid_generate_v1()`).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	partyId: uuid("party_id").notNull().references(() => party.id),
	legalName: text("legal_name").default('').notNull(),
},
(table) => {
	return {
		partyIdKey: uniqueIndex("organization_party_id_key").on(table.partyId),
	}
});

export const project = pgTable("project", {
	id: uuid("id").default(sql`uuid_generate_v1()`).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	developerId: uuid("developer_id").references(() => party.id),
	creditClassId: uuid("credit_class_id").references(() => creditClass.id),
	metadata: jsonb("metadata"),
	handle: text("handle"),
	onChainId: text("on_chain_id"),
	adminWalletId: uuid("admin_wallet_id").references(() => wallet.id),
},
(table) => {
	return {
		onChainIdIdx: index("on_chain_id_idx").on(table.onChainId),
		adminWalletIdIdx: index("project_admin_wallet_id_idx").on(table.adminWalletId),
		creditClassIdIdx: index("project_credit_class_id_idx").on(table.creditClassId),
		developerIdIdx: index("project_developer_id_idx").on(table.developerId),
		handleIdx: index("project_handle_idx").on(table.handle),
		handleKey: uniqueIndex("project_handle_key").on(table.handle),
		onChainIdKey: uniqueIndex("project_on_chain_id_key").on(table.onChainId),
	}
});

export const party = pgTable("party", {
	id: uuid("id").default(sql`uuid_generate_v1()`).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	type: partyType("type").notNull(),
	name: text("name").default('').notNull(),
	walletId: uuid("wallet_id").references(() => wallet.id),
	description: char("description", { length: 160 }),
	image: text("image").default(''),
	accountId: uuid("account_id").references(() => account.id, { onDelete: "cascade" } ),
	bgImage: text("bg_image"),
	twitterLink: text("twitter_link"),
	websiteLink: text("website_link"),
},
(table) => {
	return {
		accountIdIdx: index("party_account_id_idx").on(table.accountId),
		walletIdIdx: index("party_wallet_id_idx").on(table.walletId),
		walletIdKey: uniqueIndex("party_wallet_id_key").on(table.walletId),
	}
});

export const flywaySchemaHistory = pgTable("flyway_schema_history", {
	installedRank: integer("installed_rank").notNull(),
	version: varchar("version", { length: 50 }),
	description: varchar("description", { length: 200 }).notNull(),
	type: varchar("type", { length: 20 }).notNull(),
	script: varchar("script", { length: 1000 }).notNull(),
	checksum: integer("checksum"),
	installedBy: varchar("installed_by", { length: 100 }).notNull(),
	installedOn: timestamp("installed_on", { mode: 'string' }).defaultNow().notNull(),
	executionTime: integer("execution_time").notNull(),
	success: boolean("success").notNull(),
},
(table) => {
	return {
		sIdx: index("flyway_schema_history_s_idx").on(table.success),
	}
});