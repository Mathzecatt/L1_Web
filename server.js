const http = require("http");
const fs = require("fs");
const crypto = require("crypto");
const { Client } = require("pg");

const client = new Client({
  user: process.env.PGUSER || "postgres",
  host: "localhost",
  database: "application_image",
  port: 5432,
});
client
  .connect()
  .then(() => console.log("Connected to database"))
  .catch((e) => console.log("Error connecting", e));

let lastSessionId = 0;
let sessions = [];

function getSession(req, res) {
  let hasCookieWithSessionId = false;
  let sessionId = undefined;
  if (req.headers["cookie"] !== undefined) {
    let sessionIdInCookie = req.headers["cookie"]
      .split(";")
      .find((item) => item.trim().startsWith("session-id"));
    if (sessionIdInCookie !== undefined) {
      let sessionIdInt = parseInt(sessionIdInCookie.split("=")[1]);
      if (sessions[sessionIdInt]) {
        hasCookieWithSessionId = true;
        sessionId = sessionIdInt;
      }
    }
  }
  if (!hasCookieWithSessionId) {
    lastSessionId++;
    res.setHeader("Set-Cookie", `session-id=${lastSessionId}`);
    sessionId = lastSessionId;
    sessions[lastSessionId] = { username: null };
  }
  return sessionId;
}

// Liens auth en haut a droite
function authLinks(session) {
  if (session.username) {
    return `<div style="position:absolute;top:10px;right:10px">
              Bonjour ${session.username}
              <a href="/logout">Deconnexion</a>
            </div>`;
  }
  return `<div style="position:absolute;top:10px;right:10px">
            <a href="/signup">S inscrire</a> | <a href="/signin">Se connecter</a>
          </div>`;
}

const server = http.createServer();

server.on("request", async (req, res) => {
  const url = req.url;
  const sessionId = getSession(req, res);
  const session = sessions[sessionId];

  // --- Fichiers statiques ---
  if (
    url.startsWith("/images/") ||
    url === "/style.css" ||
    url === "/logo.png" ||
    url === "/page-image.js"
  ) {
    try {
      const content = fs.readFileSync("." + url);
      const ext = url.split(".").pop();
      const types = {
        jpg: "image/jpeg",
        png: "image/png",
        css: "text/css",
        js: "text/javascript",
      };
      res.setHeader("Content-Type", types[ext]);
      res.end(content);
    } catch {
      res.statusCode = 404;
      res.end("404");
    }
    return;
  }

  // --- POST commentaire ---
  if (url === "/image-description" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk.toString()));
    req.on("end", async () => {
      const params = new URLSearchParams(body);
      const id_image = params.get("numero");
      const texte = params.get("commentaire");
      await client.query(
        "INSERT INTO commentaires (texte, id_image) VALUES ($1, $2)",
        [texte, id_image],
      );
      res.statusCode = 302;
      res.setHeader("Location", "/page-image/" + id_image);
      res.end();
    });
    return;
  }

  // --- GET like (lien hypertexte /like/i) ---
  if (url.startsWith("/like/") && req.method === "GET") {
    if (!session.username) {
      res.statusCode = 302;
      res.setHeader("Location", "/signin");
      res.end();
      return;
    }
    const id_image = parseInt(url.split("/like/")[1]);
    if (isNaN(id_image)) {
      res.statusCode = 404;
      res.end("Image non trouvee");
      return;
    }
    try {
      const compteResult = await client.query(
        "SELECT id FROM comptes WHERE username = $1",
        [session.username],
      );
      const id_compte = compteResult.rows[0].id;
      await client.query(
        "INSERT INTO likes_images (id_compte, id_image) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [id_compte, id_image],
      );
    } catch (e) {
      console.log(e);
    }
    res.statusCode = 302;
    res.setHeader("Location", "/images.html");
    res.end();
    return;
  }

  // --- GET signup ---
  if (url === "/signup" && req.method === "GET") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(`<!DOCTYPE html>
              <html lang="fr"><head><meta charset="UTF-8"><title>Inscription</title><link rel="stylesheet" href="/style.css"></head>
              <body>
                <h1>Inscription</h1>
                <form action="/signup" method="POST">
                  <label>Username : <input type="text" name="username" required></label><br>
                  <label>Password : <input type="password" name="password" required></label><br>
                  <input type="submit" value="S inscrire">
                </form>
                <a href="/signin">Deja un compte ?</a>
              </body></html>`);
    return;
  }

  // --- POST signup ---
  if (url === "/signup" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk.toString()));
    req.on("end", async () => {
      try {
        const params = new URLSearchParams(body);
        const username = params.get("username");
        const password = params.get("password");

        // Verifier que le username n'existe pas deja (Code 10.6 du site)
        const findResult = await client.query(
          `SELECT COUNT(username) FROM comptes WHERE username='${username}'`,
        );
        if (parseInt(findResult.rows[0].count) !== 0) {
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(`<html><body><h1>Echec inscription</h1>
            <p>Ce username existe deja</p>
            <a href="/signup">Reessayer</a></body></html>`);
          return;
        }

        // Hash : update(password).update(salt) - Code 10.3 du site
        const salt = crypto.randomBytes(16).toString("hex");
        const hash = crypto
          .createHash("sha256")
          .update(password)
          .update(salt)
          .digest("hex");
        await client.query(
          `INSERT INTO comptes (username, sel, hash) VALUES ('${username}', decode('${salt}','hex'), decode('${hash}','hex'))`,
        );
        res.statusCode = 302;
        res.setHeader("Location", "/signin");
        res.end();
      } catch (e) {
        console.log(e);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(
          `<html><body><h1>Erreur</h1><a href="/signup">Reessayer</a></body></html>`,
        );
      }
    });
    return;
  }

  // --- GET signin ---
  if (url === "/signin" && req.method === "GET") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(`<!DOCTYPE html>
              <html lang="fr"><head><meta charset="UTF-8"><title>Connexion</title><link rel="stylesheet" href="/style.css"></head>
              <body>
                <h1>Connexion</h1>
                <form action="/signin" method="POST">
                  <label>Username : <input type="text" name="username" required></label><br>
                  <label>Password : <input type="password" name="password" required></label><br>
                  <input type="submit" value="Se connecter">
                </form>
                <a href="/signup">Pas encore de compte ?</a>
              </body></html>`);
    return;
  }

  // --- POST signin (Code 10.5 du site) ---
  if (url === "/signin" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk.toString()));
    req.on("end", async () => {
      try {
        const params = new URLSearchParams(body);
        const username = params.get("username");
        const password = params.get("password");
        const findResult = await client.query(
          `SELECT username, encode(sel,'hex') as sel, encode(hash,'hex') as hash FROM comptes WHERE username='${username}'`,
        );
        if (findResult.rows.length === 0) {
          res.statusCode = 302;
          res.setHeader("Location", "/signin");
          res.end();
          return;
        }
        const salt = findResult.rows[0].sel;
        const trueHash = findResult.rows[0].hash;
        const computedHash = crypto
          .createHash("sha256")
          .update(password)
          .update(salt)
          .digest("hex");
        if (trueHash === computedHash) {
          sessions[sessionId].username = username;
          res.statusCode = 302;
          res.setHeader("Location", "/");
          res.end();
        } else {
          res.statusCode = 302;
          res.setHeader("Location", "/signin");
          res.end();
        }
      } catch (e) {
        console.log(e);
        res.statusCode = 500;
        res.end("Erreur serveur");
      }
    });
    return;
  }

  // --- GET logout ---
  if (url === "/logout" && req.method === "GET") {
    sessions[sessionId].username = null;
    res.statusCode = 302;
    res.setHeader("Location", "/");
    res.end();
    return;
  }

  // --- Page accueil ---
  if (url === "/") {
    const result = await client.query(
      "SELECT id, fichier FROM images ORDER BY date DESC LIMIT 3",
    );
    let imgs = "";
    result.rows.forEach((r) => {
      imgs += `<a href="/page-image/${r.id}"><img src="/images/${r.fichier}" width="200" /></a>`;
    });

    //ADDED
    let mesLikesHTML = "";
    if (session.username) {
      const likesResult = await client.query(
        `SELECT images.id, images.fichier FROM images
         JOIN likes_images ON images.id = likes_images.id_image
         JOIN comptes ON likes_images.id_compte = comptes.id
         WHERE comptes.username = $1`,
        [session.username],
      );
      let mesImgs = "";
      likesResult.rows.forEach((r) => {
        mesImgs += `<a href="/page-image/${r.id}"><img src="/images/${r.fichier}" width="200" /></a>`;
      });
      mesLikesHTML = `<h2>Mes likes : ${likesResult.rows.length}</h2><div id="mur">${mesImgs}</div>`;
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(`<!DOCTYPE html>
            <html lang="fr">
            <head><meta charset="UTF-8"><title>Accueil</title><link rel="stylesheet" href="/style.css"></head>
            <body>
              ${authLinks(session)}
              <header>
                <a href="/"><img src="/logo.png" alt="Logo"></a>
                <h1>Galerie d images</h1>
              </header>
              <h2>3 dernieres images</h2>
              <div id="mur">${imgs}</div>
              <a href="/images.html">Voir toutes les images</a>
              ${mesLikesHTML}
            </body>
            </html>`);

    // --- Mur d'images avec lien like sous chaque image ---
  } else if (url === "/images.html") {
    const result = await client.query(
      "SELECT id, fichier FROM images ORDER BY id",
    );

    // Si connecte, recuperer les images deja likees par cet utilisateur
    let likedSet = new Set();
    if (session.username) {
      const compteResult = await client.query(
        "SELECT id FROM comptes WHERE username = $1",
        [session.username],
      );
      const id_compte = compteResult.rows[0].id;
      const likedResult = await client.query(
        "SELECT id_image FROM likes_images WHERE id_compte = $1",
        [id_compte],
      );
      likedResult.rows.forEach((r) => likedSet.add(r.id_image));
    }

    let links = "";
    result.rows.forEach((r) => {
      const small = r.fichier.replace(".jpg", "_small.jpg");
      let likeHTML = "";
      if (session.username) {
        if (likedSet.has(r.id)) {
          likeHTML = `<div>liked</div>`;
        } else {
          likeHTML = `<div><a href="/like/${r.id}">like</a></div>`;
        }
      }
      links += `<div style="display:inline-block;text-align:center;margin:4px">
        <a href="/page-image/${r.id}"><img src="/images/${small}" /></a>
        ${likeHTML}
      </div>`;
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(`<!DOCTYPE html>
              <html lang="fr">
              <head><meta charset="UTF-8"><title>Images</title><link rel="stylesheet" href="/style.css"></head>
              <body>
                ${authLinks(session)}
                <header>
                  <a href="/"><img src="/logo.png" alt="Logo"></a>
                  <h1>Galerie d images</h1>
                </header>
                <div id="mur">${links}</div>
              </body>
              </html>`);

    // --- Page image individuelle ---
  } else if (url.startsWith("/page-image/")) {
    const id = parseInt(url.split("/page-image/")[1]);
    if (isNaN(id)) {
      res.statusCode = 404;
      res.end("Image non trouvee");
      return;
    }
    const imgResult = await client.query("SELECT * FROM images WHERE id = $1", [
      id,
    ]);
    if (imgResult.rows.length === 0) {
      res.statusCode = 404;
      res.end("Image non trouvee");
      return;
    }
    const image = imgResult.rows[0];
    const commResult = await client.query(
      "SELECT texte FROM commentaires WHERE id_image = $1",
      [id],
    );
    let comments = commResult.rows
      .map((c) => `<div>-- ${c.texte} --</div>`)
      .join("");

    // Image precedente : la plus grande id < id actuel (sinon, on prend MAX)
    let prev = await client.query(
      "SELECT id, fichier FROM images WHERE id < $1 ORDER BY id DESC LIMIT 1",
      [id],
    );
    if (prev.rows.length === 0) {
      prev = await client.query(
        "SELECT id, fichier FROM images ORDER BY id DESC LIMIT 1",
      );
    }
    const prevImg = prev.rows[0];

    // Image suivante : la plus petite id > id actuel (sinon, on prend MIN)
    let next = await client.query(
      "SELECT id, fichier FROM images WHERE id > $1 ORDER BY id ASC LIMIT 1",
      [id],
    );
    if (next.rows.length === 0) {
      next = await client.query(
        "SELECT id, fichier FROM images ORDER BY id ASC LIMIT 1",
      );
    }
    const nextImg = next.rows[0];

    const prevSmall = prevImg.fichier.replace(".jpg", "_small.jpg");
    const nextSmall = nextImg.fichier.replace(".jpg", "_small.jpg");

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(`<!DOCTYPE html>
            <html lang="fr">
            <head><meta charset="UTF-8"><link rel="stylesheet" href="/style.css"><script defer src="/page-image.js"></script><title>${image.nom}</title></head>
            <body>
              ${authLinks(session)}
              <a href="/images.html">Retour</a>
              <div class="center">
                <img src="/images/${image.fichier}" width="400" />
                <p>${image.nom}</p>
              </div>
              <div class="center">
                ${comments}
                <form action="/image-description" method="POST">
                  <input type="hidden" name="numero" value="${id}" />
                  Commentaire : <input type="text" name="commentaire" maxlength="30" />
                  <input type="submit" value="Envoyer" />
                </form>
              </div>
              <div class="sub-image">
                <a href="/page-image/${prevImg.id}"><img src="/images/${prevSmall}" /></a>
                <a href="/page-image/${nextImg.id}"><img src="/images/${nextSmall}" /></a>
              </div>
            </body>
            </html>`);
  } else {
    res.statusCode = 404;
    res.end("404 - Page non trouvee");
  }
});

server.listen(8080, () =>
  console.log("Server running at http://localhost:8080/"),
);
