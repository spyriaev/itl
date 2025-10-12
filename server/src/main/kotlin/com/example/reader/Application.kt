package com.example.reader

import com.example.reader.models.CreateDocumentRequest
import com.example.reader.models.Documents
import com.example.reader.repository.DocumentRepository
import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.plugins.cors.routing.*
import io.ktor.server.plugins.statuspages.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable
import org.jetbrains.exposed.sql.Database

fun main() {
    embeddedServer(Netty, port = System.getenv("PORT")?.toIntOrNull() ?: 8080) {
        module()
    }.start(wait = true)
}

fun Application.module() {
    // Initialize database
    val databaseUrl = System.getenv("DATABASE_URL") 
        ?: "jdbc:postgresql://db.sjrfppeisxmglrozufoy.supabase.co:6543/postgres?sslmode=require"
    val dbUser = System.getenv("DATABASE_USER") ?: "postgres"
    val dbPassword = System.getenv("DATABASE_PASSWORD") ?: ""
    
    val config = HikariConfig().apply {
        jdbcUrl = databaseUrl
        username = dbUser
        password = dbPassword
        driverClassName = "org.postgresql.Driver"
        maximumPoolSize = 10
        isAutoCommit = false
        transactionIsolation = "TRANSACTION_REPEATABLE_READ"
        
        // Add SSL properties for Supabase
        addDataSourceProperty("ssl", "true")
        addDataSourceProperty("sslmode", "require")
        
        validate()
    }
    
    val dataSource = HikariDataSource(config)
    Database.connect(dataSource)
    
    // Tables are managed by Supabase migrations (see supabase/migrations/)
    // No need for SchemaUtils.createMissingTablesAndColumns as it conflicts with RLS policies
    
    val documentRepository = DocumentRepository()
    
    install(ContentNegotiation) { json() }
    install(CORS) { 
        anyHost()
        allowHeader(HttpHeaders.ContentType)
        allowMethod(HttpMethod.Options)
        allowMethod(HttpMethod.Post)
        allowMethod(HttpMethod.Get)
    }
    install(StatusPages) {
        exception<Throwable> { call, cause ->
            call.respondText(
                text = "Internal Server Error: ${cause.message}",
                status = HttpStatusCode.InternalServerError
            )
            this@module.environment.log.error("Unhandled", cause)
        }
    }

    routing {
        get("/health") { 
            call.respond(mapOf("status" to "ok")) 
        }
        
        post("/api/documents") {
            val request = call.receive<CreateDocumentRequest>()
            
            // Validate request
            if (request.mime != "application/pdf") {
                call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Only PDF files are allowed"))
                return@post
            }
            
            if (request.sizeBytes > 200 * 1024 * 1024) { // 200MB
                call.respond(HttpStatusCode.BadRequest, mapOf("error" to "File size exceeds 200MB limit"))
                return@post
            }
            
            val document = documentRepository.createDocument(request)
            call.respond(HttpStatusCode.Created, document)
        }
        
        get("/api/documents") {
            val limit = call.request.queryParameters["limit"]?.toIntOrNull() ?: 50
            val offset = call.request.queryParameters["offset"]?.toLongOrNull() ?: 0L
            
            val documents = documentRepository.listDocuments(limit, offset)
            call.respond(documents)
        }
    }
}

@Serializable
data class Health(val status: String)

