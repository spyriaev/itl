package com.example.reader.models

import kotlinx.serialization.Serializable
import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.kotlin.datetime.timestamp
import kotlinx.datetime.Clock

object Documents : Table("documents") {
    val id = uuid("id").autoGenerate()
    val ownerId = uuid("owner_id").nullable()
    val title = text("title").nullable()
    val storageKey = text("storage_key")
    val sizeBytes = long("size_bytes").nullable()
    val mime = text("mime").nullable()
    val checksumSha256 = text("checksum_sha256").nullable()
    val status = text("status").default("created")
    val createdAt = timestamp("created_at").clientDefault { Clock.System.now() }
    val uploadedBySession = text("uploaded_by_session").nullable()

    override val primaryKey = PrimaryKey(id)
}

@Serializable
data class DocumentResponse(
    val id: String,
    val title: String?,
    val storageKey: String,
    val sizeBytes: Long?,
    val mime: String?,
    val status: String,
    val createdAt: String
)

@Serializable
data class CreateDocumentRequest(
    val title: String?,
    val storageKey: String,
    val sizeBytes: Long,
    val mime: String,
    val checksumSha256: String?
)

