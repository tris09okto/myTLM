CREATE TABLE mobile_auth_refresh_tokens (
  id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  user_id INT NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY mobile_auth_refresh_tokens_token_hash_unique (token_hash),
  KEY mobile_auth_refresh_tokens_user_id_index (user_id),
  CONSTRAINT mobile_auth_refresh_tokens_user_id_foreign
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE
);
