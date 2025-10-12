package com.example.reader.repository

import com.example.reader.models.CreateDocumentRequest
import com.example.reader.models.DocumentResponse
import com.example.reader.models.Documents
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import kotlinx.datetime.Clock

class DocumentRepository {
    
    fun createDocument(request: CreateDocumentRequest): DocumentResponse = transaction {
        val id = Documents.insert {
            it[title] = request.title
            it[storageKey] = request.storageKey
            it[sizeBytes] = request.sizeBytes
            it[mime] = request.mime
            it[checksumSha256] = request.checksumSha256
            it[status] = "uploaded"
        } get Documents.id

        DocumentResponse(
            id = id.toString(),
            title = request.title,
            storageKey = request.storageKey,
            sizeBytes = request.sizeBytes,
            mime = request.mime,
            status = "uploaded",
            createdAt = Clock.System.now().toString()
        )
    }

    fun listDocuments(limit: Int = 50, offset: Long = 0): List<DocumentResponse> = transaction {
        Documents
            .slice(Documents.id, Documents.title, Documents.storageKey, Documents.sizeBytes, Documents.mime, Documents.status, Documents.createdAt)
            .selectAll()
            .orderBy(Documents.createdAt, SortOrder.DESC)
            .limit(limit, offset)
            .map { row ->
                DocumentResponse(
                    id = row[Documents.id].toString(),
                    title = row[Documents.title],
                    storageKey = row[Documents.storageKey],
                    sizeBytes = row[Documents.sizeBytes],
                    mime = row[Documents.mime],
                    status = row[Documents.status],
                    createdAt = row[Documents.createdAt].toString()
                )
            }
    }
}

