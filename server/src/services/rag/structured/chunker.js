
/**
 * Structured Database RAG - Schema Chunker
 *
 * Converts MySQL schema metadata into meaningful text chunks
 * for semantic embedding and retrieval.
 *
 * Chunk types:
 * - table
 * - column
 * - relationship
 * - business_rule
 *
 * Actual member records are NOT indexed.
 */

// ============================================
// Table Descriptions
// ============================================

const TABLE_DESCRIPTIONS = {
  Subdistrict:
    'Stores church subdistricts and their operational status. Each subdistrict can contain multiple units.',

  Unit:
    'Stores church units. Each unit can belong to a subdistrict and contain multiple life groups.',

  LifeGroup:
    'Stores church life groups, their assigned units, meeting locations and operational status.',

  Member:
    'Stores personal information of registered church members and their assigned life groups.',

  MembershipStatus:
    'Stores membership classification and believer status for each member.',

  MemberPhone:
    'Stores member contact numbers.',

  Address:
    'Stores residential address information and geographical coordinates of members.',

  User:
    'Stores application user accounts and assigned system roles. Authentication credentials must never be exposed through RAG.',

  ScopeType:
    'Defines organizational scope types used for leadership assignments.',

  Leadership:
    'Stores leadership assignments, including the assigned member, organizational scope, leadership type and assignment status.',

  MembershipActive:
    'Stores whether a member is active or inactive, including deactivation reasons and related information.',

  MemberEngagement:
    'Stores member engagement indicators for life group participation, Sunday service participation and serving.',

  Baptism:
    'Stores member baptism records, including baptism date, venue and remarks.',

  ServiceAttendance:
    'Stores aggregate church service attendance by service date and session.',

  EmailLog:
    'Stores church email communication records, including sender, recipient scope and delivery status.'
};

// ============================================
// Column Descriptions
// ============================================

const COLUMN_DESCRIPTIONS = {
  Subdistrict: {
    SubdistrictID: 'Unique identifier of a subdistrict.',
    SubdistrictName: 'Name of the subdistrict.',
    IsActive: 'TRUE means the subdistrict is operational. FALSE means it is inactive.'
  },

  Unit: {
    UnitID: 'Unique identifier of a unit.',
    SubdistrictID: 'References the subdistrict to which the unit belongs.',
    UnitName: 'Name of the unit.',
    IsActive: 'TRUE means the unit is operational. FALSE means it is inactive.'
  },

  LifeGroup: {
    LifeGroupID: 'Unique identifier of a life group.',
    UnitID: 'References the unit to which the life group belongs.',
    LifeGroupName: 'Name of the life group.',
    MeetingAddress: 'Address where the life group meets.',
    Latitude: 'Latitude of the life group meeting location.',
    Longitude: 'Longitude of the life group meeting location.',
    IsActive: 'TRUE means the life group is operational. FALSE means it is inactive.'
  },

  Member: {
    MemberID: 'Unique identifier of a member.',
    LifeGroupID: 'References the life group assigned to the member.',
    FirstName: 'First name of the member.',
    LastName: 'Last name of the member.',
    Gender: 'Gender of the member.',
    BirthDate: 'Date of birth. Can be used to calculate member age.',
    MaritalStatus: 'Marital status of the member.',
    Email: 'Email address of the member.',
    JoinDate: 'Date when the person first joined or began attending the church.',
    MemberSince: 'Date when the person officially became a church member.'
  },

  MembershipStatus: {
    MemberID: 'References the associated member.',
    MembershipType: 'Membership classification of the member.',
    BelieverStatus: 'Believer status of the member.'
  },

  MemberPhone: {
    MemberID: 'References the associated member.',
    MobileNumber: 'Mobile contact number.',
    LandlineNumber: 'Landline contact number.'
  },

  Address: {
    AddressID: 'Unique identifier of an address record.',
    MemberID: 'References the member associated with the address.',
    StreetAddress: 'Residential street address.',
    City: 'City of residence.',
    State: 'State of residence.',
    PostalCode: 'Postal code.',
    Country: 'Country of residence.',
    Latitude: 'Latitude of the residential address.',
    Longitude: 'Longitude of the residential address.'
  },

  User: {
    UserID: 'Unique identifier of an application user.',
    MemberID: 'References the member associated with the user account.',
    Role: 'System authorization role assigned to the user.',
    CreatedAt: 'Date and time when the user account was created.'
  },

  ScopeType: {
    ScopeTypeID: 'Unique identifier of an organizational scope type.',
    ScopeName: 'Name of the organizational scope type.'
  },

  Leadership: {
    LeadershipID: 'Unique identifier of a leadership assignment.',
    MemberID: 'References the member assigned to the leadership position.',
    ScopeTypeID: 'References the organizational scope type.',
    ScopeID: 'Identifier of the organizational entity associated with the selected scope type.',
    LeadershipType: 'Type of leadership position assigned.',
    IsActiveLeader: 'TRUE means the leadership assignment is currently active.',
    AssignedDate: 'Date when the leadership assignment was made.'
  },

  MembershipActive: {
    MemberID: 'References the associated member.',
    IsActive: 'TRUE means the member is active in the church. FALSE means the member is inactive or deactivated.',
    InactiveReason: 'Reason why the member was deactivated.',
    AdditionalNotes: 'Additional information about the member deactivation.',
    DeactivatedByMemberID: 'References the member who performed the deactivation.',
    DeactivatedDate: 'Date and time when the member was deactivated.'
  },

  MemberEngagement: {
    MemberID: 'References the associated member.',
    IsActiveEngage: 'Overall member engagement indicator.',
    IsActiveLifeGroup: 'Indicates active participation in a life group.',
    IsActiveSundayService: 'Indicates active participation in Sunday services.',
    IsActiveServing: 'Indicates active involvement in serving.'
  },

  Baptism: {
    MemberID: 'References the associated member.',
    BaptismDate: 'Date when the member was baptised.',
    Venue: 'Location where the baptism took place.',
    Remarks: 'Additional baptism remarks.'
  },

  ServiceAttendance: {
    AttendanceID: 'Unique identifier of an attendance record.',
    ServiceDate: 'Date of the church service.',
    SessionTime: 'Session time of the church service.',
    AttendanceCount: 'Aggregate number of attendees for the service session.',
    Remarks: 'Additional attendance notes.'
  },

  EmailLog: {
    EmailID: 'Unique identifier of an email record.',
    SenderUserID: 'References the user who created or sent the email.',
    Subject: 'Subject of the email.',
    Message: 'Content of the email.',
    RecipientScope: 'Recipient scope of the email.',
    Status: 'Current status of the email.',
    CreatedAt: 'Date and time when the email record was created.',
    UpdatedAt: 'Date and time when the email record was last updated.',
    SentAt: 'Date and time when the email was sent.'
  }
};

// ============================================
// Sensitive Columns
// ============================================

const SENSITIVE_COLUMNS = {
  User: ['PasswordHash']
};

const tableMetadata = (metadata, tableName) =>
  metadata[Object.keys(metadata).find(name => name.toLowerCase() === tableName.toLowerCase())];

const isSensitiveColumn = (tableName, columnName) =>
  (tableMetadata(SENSITIVE_COLUMNS, tableName) || [])
    .some(name => name.toLowerCase() === columnName.toLowerCase());

// ============================================
// Approved Categorical Values
// ============================================

/**
 * These values are explicitly defined in the supplied
 * MySQL schema.
 *
 * Do not add assumed membership types, leadership roles,
 * or believer statuses without verifying the application.
 */
const CATEGORICAL_VALUES = {
  MembershipActive: {
    InactiveReason: [
      'Transferred University',
      'Moved',
      'Changed Church',
      'Migrant',
      'Personal',
      'Others'
    ]
  },

  EmailLog: {
    Status: [
      'Draft',
      'Sent',
      'Failed',
      'Discarded'
    ]
  }
};

// ============================================
// Business Rules
// ============================================

/**
 * Additional semantic information that cannot be fully
 * represented by ordinary column metadata.
 */
const BUSINESS_RULES = [
  {
    id: 'member-active-status',
    sourceTable: 'MembershipActive',

    text: [
      'Business rule: Member active status.',
      'To determine whether a church member is active or inactive,',
      'use MembershipActive.IsActive.',
      'Start from Member and LEFT JOIN MembershipActive on MemberID.',
      'Members with no MembershipActive row or NULL IsActive are active by default,',
      'matching the dashboard and member list.',
      'Filter active members with COALESCE(ma.IsActive, 1) = 1.',
      'Example: SELECT COUNT(*) AS ActiveMembers FROM Member m',
      'LEFT JOIN MembershipActive ma ON ma.MemberID = m.MemberID',
      'WHERE COALESCE(ma.IsActive, 1) = 1.',
      'Do not count only rows in MembershipActive for total active church members.',
      'TRUE means active.',
      'FALSE means inactive.',
      'Do not confuse member activity with Subdistrict.IsActive,',
      'Unit.IsActive or LifeGroup.IsActive.'
    ].join(' ')
  },

  {
    id: 'member-engagement',
    sourceTable: 'MemberEngagement',

    text: [
      'Business rule: Member engagement.',
      'MemberEngagement stores separate indicators for overall engagement,',
      'life group participation, Sunday service participation and serving.',
      'These indicators are different from MembershipActive.IsActive.',
      'An active church member is not necessarily active in every engagement category.'
    ].join(' ')
  },

  {
    id: 'organization-hierarchy',
    sourceTable: 'Subdistrict',

    text: [
      'Business rule: Church organizational hierarchy.',
      'A Subdistrict contains Units.',
      'A Unit contains LifeGroups.',
      'A LifeGroup can contain multiple Members.',
      'Join Subdistrict to Unit using SubdistrictID.',
      'Join Unit to LifeGroup using UnitID.',
      'Join LifeGroup to Member using LifeGroupID.'
    ].join(' ')
  },

  {
    id: 'leadership-scope',
    sourceTable: 'Leadership',

    text: [
      'Business rule: Leadership scope.',
      'Leadership.ScopeTypeID references ScopeType.ScopeTypeID.',
      'Leadership.ScopeID stores the identifier of the organizational entity',
      'associated with the selected scope type.',
      'ScopeID is not declared as a direct foreign key to a specific',
      'organizational table.',
      'The application must resolve the appropriate target table',
      'using the verified ScopeType mapping before joining ScopeID.',
      'Do not assume that ScopeID always references the same table.'
    ].join(' ')
  },

  {
    id: 'service-attendance',
    sourceTable: 'ServiceAttendance',

    text: [
      'Business rule: Service attendance.',
      'ServiceAttendance stores aggregate attendance counts',
      'for each service date and session.',
      'AttendanceCount represents a recorded total, not an individual member.',
      'The schema does not contain a direct relationship between',
      'ServiceAttendance and Member.'
    ].join(' ')
  },

  {
    id: 'membership-status',
    sourceTable: 'MembershipStatus',

    text: [
      'Business rule: Membership classification.',
      'MembershipStatus.MembershipType describes membership classification.',
      'MembershipStatus.BelieverStatus describes believer status.',
      'These fields are different from MembershipActive.IsActive,',
      'which determines whether the member is active or inactive.'
    ].join(' ')
  }
];

// ============================================
// Table Chunk
// ============================================

const createTableChunk = (tableName, columns) => {
  const columnDescriptions = columns
    .filter(column =>
      !isSensitiveColumn(tableName, column.COLUMN_NAME)
    )
    .map(column => {
      const description =
        tableMetadata(COLUMN_DESCRIPTIONS, tableName)?.[column.COLUMN_NAME] || '';

      const values =
        tableMetadata(CATEGORICAL_VALUES, tableName)?.[column.COLUMN_NAME];

      return [
        `- ${column.COLUMN_NAME}`,
        `(${column.COLUMN_TYPE})`,
        description,
        values ? `Allowed values: ${values.join(', ')}.` : ''
      ].filter(Boolean).join(' ');
    });

  return {
    type: 'table',
    sourceTable: tableName,

    text: [
      `Table: ${tableName}`,
      `Description: ${tableMetadata(TABLE_DESCRIPTIONS, tableName) || ''}`,
      'Columns:',
      ...columnDescriptions
    ].join('\n')
  };
};

// ============================================
// Column Chunk
// ============================================

const createColumnChunk = (column) => {
  const tableName = column.TABLE_NAME;
  const columnName = column.COLUMN_NAME;

  const description =
    tableMetadata(COLUMN_DESCRIPTIONS, tableName)?.[columnName] ||
    'No additional description provided.';

  const values =
    tableMetadata(CATEGORICAL_VALUES, tableName)?.[columnName];

  return {
    type: 'column',
    sourceTable: tableName,

    text: [
      `Table: ${tableName}`,
      `Column: ${columnName}`,
      `Data type: ${column.COLUMN_TYPE}`,
      `Nullable: ${column.IS_NULLABLE}`,
      `Key: ${column.COLUMN_KEY || 'None'}`,
      `Description: ${description}`,

      ...(values
        ? [`Allowed values: ${values.join(', ')}`]
        : [])
    ].join('\n')
  };
};

// ============================================
// Relationship Chunk
// ============================================

const createRelationshipChunk = (relationship) => ({
  type: 'relationship',
  sourceTable: relationship.TABLE_NAME,

  text: [
    'Foreign key relationship:',
    `${relationship.TABLE_NAME}.${relationship.COLUMN_NAME}`,
    'references',
    `${relationship.REFERENCED_TABLE_NAME}.${relationship.REFERENCED_COLUMN_NAME}`
  ].join(' ')
});

// ============================================
// Business Rule Chunk
// ============================================

const createBusinessRuleChunk = (rule) => ({
  type: 'business_rule',
  sourceTable: rule.sourceTable,
  ruleId: rule.id,
  text: rule.text
});

// ============================================
// Main Chunking Function
// ============================================

const chunkSchema = (columns, relationships) => {
  const chunks = [];
  const groupedTables = {};

  // Group extracted columns by table
  for (const column of columns) {
    const tableName = column.TABLE_NAME;

    if (!groupedTables[tableName]) {
      groupedTables[tableName] = [];
    }

    groupedTables[tableName].push(column);
  }

  // Generate table-level and column-level chunks
  for (const [tableName, tableColumns] of
    Object.entries(groupedTables)) {

    chunks.push(
      createTableChunk(tableName, tableColumns)
    );

    for (const column of tableColumns) {
      if (
        isSensitiveColumn(
          tableName,
          column.COLUMN_NAME
        )
      ) {
        continue;
      }

      chunks.push(
        createColumnChunk(column)
      );
    }
  }

  // Generate foreign-key relationship chunks
  for (const relationship of relationships) {
    if (
      isSensitiveColumn(
        relationship.TABLE_NAME,
        relationship.COLUMN_NAME
      ) ||
      isSensitiveColumn(
        relationship.REFERENCED_TABLE_NAME,
        relationship.REFERENCED_COLUMN_NAME
      )
    ) {
      continue;
    }

    chunks.push(
      createRelationshipChunk(relationship)
    );
  }

  // Generate business-rule chunks for extracted tables only
  const extractedTables = new Set(
    Object.keys(groupedTables).map(table => table.toLowerCase())
  );

  for (const rule of BUSINESS_RULES) {
    if (!extractedTables.has(rule.sourceTable.toLowerCase())) {
      continue;
    }

    chunks.push(
      createBusinessRuleChunk(rule)
    );
  }

  // Assign chunk IDs
  return chunks.map((chunk, index) => ({
    chunkId: index + 1,
    ...chunk
  }));
};

module.exports = {
  chunkSchema,
  TABLE_DESCRIPTIONS,
  COLUMN_DESCRIPTIONS,
  CATEGORICAL_VALUES,
  BUSINESS_RULES
};
