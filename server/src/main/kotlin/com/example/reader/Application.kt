package com.example.reader

import io.ktor.server.application.*
import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.plugins.cors.routing.*
import io.ktor.server.plugins.statuspages.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable

fun main() {
    embeddedServer(Netty, port = System.getenv("PORT")?.toIntOrNull() ?: 8080) {
        module()
    }.start(wait = true)
}

fun Application.module() {
    install(ContentNegotiation) { json() }
    install(CORS) { anyHost() }
    install(StatusPages) {
        exception<Throwable> { call, cause ->
            call.respondText(text = "Internal Server Error", status = io.ktor.http.HttpStatusCode.InternalServerError)
            environment.log.error("Unhandled", cause)
        }
    }

    routing {
        get("/health") { call.respond(mapOf("status" to "ok")) }
    }
}

@Serializable
data class Health(val status: String)
