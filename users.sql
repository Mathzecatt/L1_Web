CREATE TABLE IF NOT EXISTS comptes (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    sel BYTEA NOT NULL,
    hash BYTEA NOT NULL
);

CREATE TABLE IF NOT EXISTS likes_images (
    id_compte int references comptes(id),
    id_image int references images(id),
    PRIMARY KEY (id_compte, id_image)
);
