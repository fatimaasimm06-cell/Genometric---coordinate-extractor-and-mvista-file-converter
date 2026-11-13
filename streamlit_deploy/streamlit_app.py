"""
Streamlit entry point for NEXUS // VISTA (GenBank & mVISTA Converter).

This file does NOT change the UI (index.html + static/) or the backend (app.py).
It works like this:

  1. Your original index.html is served full-screen inside Streamlit as a
     custom component, together with your static/ folder (CSS, JS, assets).
  2. A tiny bridge script is injected at runtime. Whenever the page calls
     the backend (/convert-mvista or /extract), the bridge sends the request
     to Python through Streamlit instead of over HTTP.
  3. Python hands that request to your unchanged Flask routes in app.py
     (via Flask's built-in test client) and sends the exact same JSON back.

Run locally:   streamlit run streamlit_app.py
"""

import importlib.util
import io
import os
import re
import shutil
import sys
import tempfile

import streamlit as st
import streamlit.components.v1 as components

HERE = os.path.abspath(os.path.dirname(__file__))

st.set_page_config(
    page_title="NEXUS GENOME // GenBank & mVISTA Annotation Converter",
    page_icon="🧬",
    layout="wide",
    initial_sidebar_state="collapsed",
)


# ----------------------------------------------------------------------
# Locate the original project files (nothing is moved or edited)
# ----------------------------------------------------------------------
def _first_existing(paths):
    for p in paths:
        if os.path.exists(p):
            return os.path.abspath(p)
    return None


APP_PY = _first_existing([
    os.path.join(HERE, "app.py"),
    os.path.join(HERE, "..", "api", "app.py"),        # repo layout: api/app.py
    os.path.join(HERE, "api", "app.py"),
])
INDEX_HTML = _first_existing([
    os.path.join(HERE, "templates", "index.html"),   # Flask template folder
    os.path.join(HERE, "index.html"),
    os.path.join(HERE, "..", "templates", "index.html"),
    os.path.join(HERE, "..", "api", "templates", "index.html"),
])
STATIC_DIR = _first_existing([
    os.path.join(HERE, "..", "static"),               # what app.py uses
    os.path.join(HERE, "static"),
    os.path.join(HERE, "..", "..", "static"),
])

if not APP_PY or not INDEX_HTML:
    st.error(
        "Could not find app.py / index.html. Expected api/app.py and "
        "templates/index.html at the repo root, next to this folder."
    )
    st.stop()


# ----------------------------------------------------------------------
# Load the unchanged Flask backend
# ----------------------------------------------------------------------
@st.cache_resource(show_spinner=False)
def load_backend():
    spec = importlib.util.spec_from_file_location("nexus_backend", APP_PY)
    module = importlib.util.module_from_spec(spec)
    sys.modules["nexus_backend"] = module
    spec.loader.exec_module(module)  # app.run() is behind __main__, so no server starts
    return module.app.test_client()


# ----------------------------------------------------------------------
# Bridge: replaces HTTP calls to the Flask routes with Streamlit messages
# ----------------------------------------------------------------------
BRIDGE_JS = r"""
<script>
(function () {
  var ROUTE = /\/(convert-mvista|extract)\/?(\?.*)?$/;
  var pending = {}, seq = 0, queue = Promise.resolve();

  function post(type, data) {
    window.parent.postMessage(Object.assign({ isStreamlitMessage: true, type: type }, data || {}), "*");
  }

  window.addEventListener("message", function (ev) {
    var d = ev.data;
    if (!d || d.type !== "streamlit:render") return;
    var r = d.args && d.args.response;
    if (r && pending[r.id]) { var done = pending[r.id]; delete pending[r.id]; done(r); }
  });

  post("streamlit:componentReady", { apiVersion: 1 });
  function syncHeight() { post("streamlit:setFrameHeight", { height: window.innerHeight || 800 }); }
  window.addEventListener("load", syncHeight);
  window.addEventListener("resize", syncHeight);
  syncHeight();

  async function packBody(body, headers) {
    if (!body) return { kind: "text", text: "" };
    if (typeof FormData !== "undefined" && body instanceof FormData) {
      var fields = {};
      body.forEach(function (v, k) { if (typeof v === "string" && k !== "text") fields[k] = v; });
      var f = body.get("file");
      if (f && typeof f === "object" && "text" in f && f.name) {
        return { kind: "file", text: await f.text(), filename: f.name, fields: fields };
      }
      var t = body.get("text");
      return { kind: "text", text: t == null ? "" : String(t), fields: fields };
    }
    if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) {
      return { kind: "text", text: body.get("text") || "" };
    }
    if (typeof Blob !== "undefined" && body instanceof Blob) {
      return { kind: "file", text: await body.text(), filename: body.name || "upload.gb" };
    }
    if (typeof body === "string") {
      try { var j = JSON.parse(body); if (j && typeof j === "object") return { kind: "json", text: j.text || "" }; } catch (e) {}
      return { kind: "text", text: body };
    }
    return { kind: "text", text: String(body) };
  }

  function callPython(endpoint, payload) {
    var run = function () {
      return new Promise(function (resolve, reject) {
        var id = Date.now() + "-" + (++seq);
        pending[id] = resolve;
        post("streamlit:setComponentValue", {
          value: Object.assign({ id: id, endpoint: endpoint }, payload),
          dataType: "json"
        });
        setTimeout(function () {
          if (pending[id]) { delete pending[id]; reject(new TypeError("Backend timed out")); }
        }, 180000);
      });
    };
    var p = queue.then(run, run);
    queue = p.catch(function () {});
    return p;
  }

  // ---- fetch() ----
  var nativeFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = async function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || String(input);
    var m = url.match(ROUTE);
    if (!m) return nativeFetch(input, init);
    var body = init && init.body;
    if (!body && typeof Request !== "undefined" && input instanceof Request) {
      try { body = await input.clone().formData(); } catch (e) { body = await input.clone().text(); }
    }
    var r = await callPython(m[1], await packBody(body));
    return new Response(JSON.stringify(r.body), {
      status: r.status, headers: { "Content-Type": "application/json" }
    });
  };

  // ---- XMLHttpRequest (in case the page uses it) ----
  var NativeXHR = window.XMLHttpRequest;
  function BridgedXHR() {
    var xhr = new NativeXHR(), self = this, route = null, headers = {};
    this.readyState = 0; this.status = 0; this.responseText = ""; this.response = "";
    this.responseType = ""; this.upload = xhr.upload;
    ["onload", "onerror", "onreadystatechange", "onloadend", "onprogress", "ontimeout", "onabort"]
      .forEach(function (k) { self[k] = null; });
    var listeners = {};
    this.addEventListener = function (t, fn) { (listeners[t] = listeners[t] || []).push(fn); xhr.addEventListener(t, fn); };
    this.removeEventListener = function (t, fn) { xhr.removeEventListener(t, fn); };
    function fire(t) {
      var ev = { type: t, target: self, currentTarget: self };
      if (typeof self["on" + t] === "function") self["on" + t](ev);
      (listeners[t] || []).forEach(function (fn) { fn.call(self, ev); });
    }
    this.open = function (method, url) {
      var m = String(url).match(ROUTE);
      route = m ? m[1] : null;
      if (!route) {
        xhr.open.apply(xhr, arguments);
        ["onload", "onerror", "onreadystatechange", "onloadend", "onprogress", "ontimeout", "onabort"]
          .forEach(function (k) { xhr[k] = function (e) { ["readyState", "status", "statusText", "responseText", "response", "responseURL"].forEach(function (p) { try { self[p] = xhr[p]; } catch (x) {} }); if (self[k]) self[k](e); }; });
      }
      self.readyState = 1;
    };
    this.setRequestHeader = function (k, v) { if (route) headers[k] = v; else xhr.setRequestHeader(k, v); };
    this.getResponseHeader = function (k) { return route ? (/content-type/i.test(k) ? "application/json" : null) : xhr.getResponseHeader(k); };
    this.getAllResponseHeaders = function () { return route ? "content-type: application/json\r\n" : xhr.getAllResponseHeaders(); };
    this.abort = function () { if (!route) xhr.abort(); };
    this.overrideMimeType = function (t) { if (!route) xhr.overrideMimeType(t); };
    this.send = function (body) {
      if (!route) { if (self.responseType) xhr.responseType = self.responseType; return xhr.send(body); }
      packBody(body, headers).then(function (payload) { return callPython(route, payload); })
        .then(function (r) {
          self.status = r.status; self.statusText = r.status === 200 ? "OK" : "Error";
          self.responseText = JSON.stringify(r.body);
          self.response = self.responseType === "json" ? r.body : self.responseText;
          self.readyState = 4;
          fire("readystatechange"); fire("load"); fire("loadend");
        })
        .catch(function () { self.readyState = 4; fire("readystatechange"); fire("error"); fire("loadend"); });
    };
  }
  BridgedXHR.UNSENT = 0; BridgedXHR.OPENED = 1; BridgedXHR.HEADERS_RECEIVED = 2; BridgedXHR.LOADING = 3; BridgedXHR.DONE = 4;
  window.XMLHttpRequest = BridgedXHR;
})();
</script>
"""


def _relink_static(text):
    """'/static/...' -> 'static/...' so files resolve inside the component."""
    return re.sub(r"""(["'`(])/static/""", r"\1static/", text)


@st.cache_resource(show_spinner=False)
def build_frontend():
    """Copies index.html + static/ into a temp folder Streamlit can serve.

    The originals are never modified.
    """
    out_dir = os.path.join(tempfile.gettempdir(), "nexus_vista_component")
    if os.path.isdir(out_dir):
        shutil.rmtree(out_dir, ignore_errors=True)
    os.makedirs(out_dir, exist_ok=True)

    if STATIC_DIR:
        shutil.copytree(STATIC_DIR, os.path.join(out_dir, "static"), dirs_exist_ok=True)
        # JS may build '/static/...' URLs at runtime; make them relative too.
        for root, _, files in os.walk(os.path.join(out_dir, "static")):
            for name in files:
                if name.endswith(".js"):
                    path = os.path.join(root, name)
                    with open(path, "r", encoding="utf-8", errors="ignore") as fh:
                        src = fh.read()
                    patched = _relink_static(src)
                    if patched != src:
                        with open(path, "w", encoding="utf-8") as fh:
                            fh.write(patched)

    with open(INDEX_HTML, "r", encoding="utf-8") as fh:
        html = fh.read()
    html = _relink_static(html)
    # Inject the bridge as the very first thing in <head> so it is in place
    # before any of the page's own scripts run.
    html = re.sub(r"(<head[^>]*>)", lambda m: m.group(1) + BRIDGE_JS, html, count=1, flags=re.I)

    with open(os.path.join(out_dir, "index.html"), "w", encoding="utf-8") as fh:
        fh.write(html)
    return out_dir


def run_backend(req):
    """Forwards a bridged request to the original Flask route."""
    client = load_backend()
    endpoint = "/" + req.get("endpoint", "convert-mvista")
    kind = req.get("kind", "text")
    text = req.get("text", "") or ""
    fields = {str(k): str(v) for k, v in (req.get("fields") or {}).items()}  # e.g. 'features'

    if kind == "file":
        data = dict(fields)
        data["file"] = (io.BytesIO(text.encode("utf-8")), req.get("filename") or "upload.gb")
        resp = client.post(endpoint, data=data, content_type="multipart/form-data")
    elif kind == "json":
        resp = client.post(endpoint, json={"text": text})
    else:
        resp = client.post(endpoint, data=dict(fields, text=text))

    body = resp.get_json(silent=True)
    if body is None:
        body = {"success": False, "error": resp.get_data(as_text=True)[:500]}
    return {"id": req.get("id"), "status": resp.status_code, "body": body}


# ----------------------------------------------------------------------
# Full-screen layout: hide Streamlit chrome so only your UI shows
# ----------------------------------------------------------------------
st.markdown(
    """
    <style>
      header[data-testid="stHeader"], [data-testid="stToolbar"], [data-testid="stDecoration"],
      [data-testid="stStatusWidget"], #MainMenu, footer { display: none !important; }
      html, body, .stApp, [data-testid="stAppViewContainer"], [data-testid="stMain"] {
        background: #050a14 !important; overflow: hidden !important;
      }
      .block-container, [data-testid="stMainBlockContainer"] {
        padding: 0 !important; max-width: 100% !important;
      }
      iframe {
        position: fixed !important; inset: 0 !important;
        width: 100vw !important; height: 100vh !important;
        border: 0 !important; z-index: 999 !important;
      }
      [data-stale="true"], .stale-element { opacity: 1 !important; transition: none !important; }
    </style>
    """,
    unsafe_allow_html=True,
)

nexus_ui = components.declare_component("nexus_vista", path=build_frontend())

request = nexus_ui(response=st.session_state.get("nexus_response"), key="nexus_ui", default=None)

if request and request.get("id") and request["id"] != st.session_state.get("nexus_last_id"):
    st.session_state["nexus_last_id"] = request["id"]
    try:
        st.session_state["nexus_response"] = run_backend(request)
    except Exception as exc:  # surface errors to the page's own error handling
        st.session_state["nexus_response"] = {
            "id": request["id"], "status": 500,
            "body": {"success": False, "error": f"Server error: {exc}"},
        }
    st.rerun()
