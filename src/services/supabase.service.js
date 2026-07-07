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
    client = createClient(config.supabaseUrl, config.supabaseServerKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  return client;
}

module.exports = {
  getSupabaseClient,
  getSupabaseError
};