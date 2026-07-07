const { createClient } = require("@supabase/supabase-js");
const config = require("../config/env");

let client = null;

function getSupabaseError() {
  if (!config.supabaseUrl) {
    return "Thiếu SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_URL.";
  }
  if (!config.supabaseServerKey) {
    return "Thiếu SUPABASE_SECRET_KEY hoặc SUPABASE_SERVICE_ROLE_KEY cho server upload.";
  }
  return null;
}

function getSupabaseClient() {
  const configError = getSupabaseError();
  if (configError) {
    throw new Error(configError);
  }

  if (!client) {
    const options = {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    };

    try {
      const WebSocket = require("ws");
      options.realtime = { transport: WebSocket };
    } catch (_error) {
      // ws optional; storage upload still works when realtime transport unavailable
    }

    client = createClient(config.supabaseUrl, config.supabaseServerKey, options);
  }

  return client;
}

module.exports = {
  getSupabaseClient,
  getSupabaseError
};