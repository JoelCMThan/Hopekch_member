
CREATE TABLE IF NOT EXISTS RAGQueryLog (
    QueryID BIGINT AUTO_INCREMENT PRIMARY KEY,

    MemberID INT NULL,

    Question TEXT NOT NULL,

    GeneratedSQL TEXT NULL,

    RetrievedChunks JSON NULL,

    Answer TEXT NULL,

    RetrievalTimeMs INT NULL,
    GenerationTimeMs INT NULL,
    ExecutionTimeMs INT NULL,
    TotalTimeMs INT NULL,

    Status ENUM(
        'success',
        'failed',
        'rejected'
    ) NOT NULL,

    ErrorMessage TEXT NULL,

    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_created_at (CreatedAt),

    CONSTRAINT fk_rag_member
        FOREIGN KEY (MemberID)
        REFERENCES Member(MemberID)
        ON DELETE SET NULL
);
