#!/usr/bin/env python3
"""
Cast a video to LG WebOS TV via DLNA/UPnP (no pairing required).

Discovered: [LG] webOS TV UQ7070ZUD @ 192.168.1.5

Usage:
  python3 scripts/cast_to_tv.py <video_url_or_file>
  python3 scripts/cast_to_tv.py /path/to/local/video.mp4
  python3 scripts/cast_to_tv.py "http://192.168.1.22:8080/video.mp4"
  python3 scripts/cast_to_tv.py --discover        # Re-scan network
  python3 scripts/cast_to_tv.py --status          # TV transport state
  python3 scripts/cast_to_tv.py --stop            # Stop playback

Examples:
  python3 scripts/cast_to_tv.py /tmp/movie.mp4
  python3 scripts/cast_to_tv.py "http://192.168.1.22:5000/stream/video.mp4"
"""

import sys, os, time, socket, threading, argparse, http.server
import xml.etree.ElementTree as ET
import requests

# ── Defaults ──────────────────────────────────────────────────────────────────
TV_IP        = "192.168.1.5"
TV_DLNA_PORT = 1817
TV_UUID      = "8d582192-81be-8504-ddaa-27e1bf7d5fde"
SERVE_PORT   = 8766          # local HTTP port for serving files
MY_IP        = "192.168.1.22"

CTRL_URL = f"http://{TV_IP}:{TV_DLNA_PORT}/AVTransport/{TV_UUID}/control.xml"
MIME_MAP = {
    ".mp4": "video/mp4", ".mkv": "video/x-matroska", ".avi": "video/x-msvideo",
    ".mov": "video/quicktime", ".m4v": "video/mp4", ".webm": "video/webm",
    ".mp3": "audio/mpeg", ".flac": "audio/flac", ".aac": "audio/aac",
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
}

# ── DLNA helpers ──────────────────────────────────────────────────────────────

def soap_call(action, body_inner):
    resp = requests.post(
        CTRL_URL,
        headers={
            "Content-Type": 'text/xml; charset="utf-8"',
            "SOAPAction": f'"urn:schemas-upnp-org:service:AVTransport:1#{action}"',
        },
        data=(
            '<?xml version="1.0" encoding="utf-8"?>'
            '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"'
            ' s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">'
            f"<s:Body>{body_inner}</s:Body></s:Envelope>"
        ),
        timeout=10,
    )
    return resp

def dlna_stop():
    return soap_call("Stop",
        '<u:Stop xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">'
        "<InstanceID>0</InstanceID></u:Stop>")

def dlna_play():
    return soap_call("Play",
        '<u:Play xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">'
        "<InstanceID>0</InstanceID><Speed>1</Speed></u:Play>")

def dlna_pause():
    return soap_call("Pause",
        '<u:Pause xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">'
        "<InstanceID>0</InstanceID></u:Pause>")

def dlna_set_uri(url, title="Video", mime="video/mp4"):
    dlna_flags = "01700000000000000000000000000000"
    meta = (
        '&lt;DIDL-Lite xmlns:dc=&quot;http://purl.org/dc/elements/1.1/&quot; '
        'xmlns:upnp=&quot;urn:schemas-upnp-org:metadata-1-0/upnp/&quot; '
        'xmlns=&quot;urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/&quot;&gt;'
        '&lt;item id=&quot;1&quot; parentID=&quot;0&quot; restricted=&quot;1&quot;&gt;'
        f'&lt;dc:title&gt;{title}&lt;/dc:title&gt;'
        '&lt;upnp:class&gt;object.item.videoItem&lt;/upnp:class&gt;'
        f'&lt;res protocolInfo=&quot;http-get:*:{mime}:DLNA.ORG_OP=01;'
        f'DLNA.ORG_FLAGS={dlna_flags}&quot;&gt;{url}&lt;/res&gt;'
        '&lt;/item&gt;&lt;/DIDL-Lite&gt;'
    )
    return soap_call("SetAVTransportURI",
        '<u:SetAVTransportURI xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">'
        f"<InstanceID>0</InstanceID><CurrentURI>{url}</CurrentURI>"
        f"<CurrentURIMetaData>{meta}</CurrentURIMetaData></u:SetAVTransportURI>")

def dlna_transport_info():
    r = soap_call("GetTransportInfo",
        '<u:GetTransportInfo xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">'
        "<InstanceID>0</InstanceID></u:GetTransportInfo>")
    try:
        root = ET.fromstring(r.text)
        ns = {"s": "http://schemas.xmlsoap.org/soap/envelope/",
              "u": "urn:schemas-upnp-org:service:AVTransport:1"}
        state = root.find(".//CurrentTransportState")
        status = root.find(".//CurrentTransportStatus")
        return (state.text if state is not None else "?",
                status.text if status is not None else "?")
    except Exception:
        return ("?", "?")

def dlna_position_info():
    r = soap_call("GetPositionInfo",
        '<u:GetPositionInfo xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">'
        "<InstanceID>0</InstanceID></u:GetPositionInfo>")
    try:
        root = ET.fromstring(r.text)
        track_uri = root.find(".//TrackURI")
        rel_time  = root.find(".//RelTime")
        duration  = root.find(".//TrackDuration")
        return {
            "uri":      track_uri.text if track_uri is not None else "",
            "position": rel_time.text  if rel_time  is not None else "0:00:00",
            "duration": duration.text  if duration  is not None else "0:00:00",
        }
    except Exception:
        return {}

# ── Local file server ─────────────────────────────────────────────────────────

class _MimeHandler(http.server.SimpleHTTPRequestHandler):
    def guess_type(self, path):
        ext = os.path.splitext(str(path))[1].lower()
        return MIME_MAP.get(ext, super().guess_type(path))
    def log_message(self, fmt, *args):
        pass  # quiet

def start_file_server(directory, port=SERVE_PORT):
    os.chdir(directory)
    srv = http.server.HTTPServer(("0.0.0.0", port), _MimeHandler)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    return srv

# ── SSDP discovery ────────────────────────────────────────────────────────────

def discover_lg_tv(timeout=6):
    msg = "\r\n".join([
        "M-SEARCH * HTTP/1.1", "HOST: 239.255.255.250:1900",
        'MAN: "ssdp:discover"', "MX: 3", "ST: ssdp:all", "", ""
    ])
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
    sock.settimeout(timeout)
    sock.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, 2)
    sock.sendto(msg.encode(), ("239.255.255.250", 1900))
    found = []
    try:
        while True:
            data, addr = sock.recvfrom(4096)
            text = data.decode("utf-8", errors="ignore")
            if "LGE" in text or "webOS" in text or "lge.com" in text:
                found.append((addr[0], text))
    except socket.timeout:
        pass
    return found

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Cast video to LG WebOS TV via DLNA (no pairing needed)"
    )
    parser.add_argument("target", nargs="?",
        help="Video file path or HTTP URL to cast")
    parser.add_argument("--ip",       default=TV_IP,
        help=f"TV IP address (default: {TV_IP})")
    parser.add_argument("--discover", action="store_true",
        help="Scan LAN for LG TVs")
    parser.add_argument("--status",   action="store_true",
        help="Show current TV playback state")
    parser.add_argument("--stop",     action="store_true",
        help="Stop TV playback")
    parser.add_argument("--pause",    action="store_true",
        help="Pause TV playback")
    parser.add_argument("--port",     type=int, default=SERVE_PORT,
        help=f"Local HTTP server port for local files (default: {SERVE_PORT})")
    parser.add_argument("--my-ip",    default=MY_IP,
        help=f"This machine's LAN IP (default: {MY_IP})")
    args = parser.parse_args()

    # Update globals if overridden
    global CTRL_URL
    if args.ip != TV_IP:
        CTRL_URL = f"http://{args.ip}:{TV_DLNA_PORT}/AVTransport/{TV_UUID}/control.xml"

    # ── Discover ────────────────────────────────────────────────────────────
    if args.discover:
        print("Scanning for LG TVs...")
        devices = discover_lg_tv()
        if not devices:
            print("  No LG TVs found on the local network.")
            return
        seen = set()
        for ip, resp in devices:
            key = ip + "".join(l for l in resp.splitlines() if "DLNADeviceName" in l)
            if key in seen:
                continue
            seen.add(key)
            print(f"\n  {ip}")
            for line in resp.splitlines():
                if any(k in line for k in ["Server:", "Location:", "DLNADeviceName"]):
                    print(f"    {line.strip()}")
        return

    # ── Status ──────────────────────────────────────────────────────────────
    if args.status:
        state, status = dlna_transport_info()
        pos = dlna_position_info()
        print(f"  State:    {state} ({status})")
        if pos.get("uri"):
            print(f"  Stream:   {pos['uri']}")
            print(f"  Position: {pos['position']} / {pos['duration']}")
        return

    # ── Stop / Pause ────────────────────────────────────────────────────────
    if args.stop:
        r = dlna_stop()
        print("Stopped." if r.status_code == 200 else f"Error {r.status_code}")
        return
    if args.pause:
        r = dlna_pause()
        print("Paused." if r.status_code == 200 else f"Error {r.status_code}")
        return

    if not args.target:
        parser.print_help()
        return

    # ── Resolve target ──────────────────────────────────────────────────────
    srv = None
    if args.target.startswith("http://") or args.target.startswith("https://"):
        stream_url = args.target
        title = os.path.basename(stream_url.split("?")[0]) or "Video"
        ext   = os.path.splitext(title)[1].lower()
    else:
        # Local file — serve it over HTTP
        fpath = os.path.abspath(args.target)
        if not os.path.exists(fpath):
            print(f"Error: file not found: {fpath}")
            sys.exit(1)
        fname     = os.path.basename(fpath)
        title     = fname
        ext       = os.path.splitext(fname)[1].lower()
        directory = os.path.dirname(fpath)
        srv       = start_file_server(directory, args.port)
        stream_url = f"http://{args.my_ip}:{args.port}/{fname}"
        print(f"Serving '{fname}' at {stream_url}")

    mime = MIME_MAP.get(ext, "video/mp4")

    # ── Cast ────────────────────────────────────────────────────────────────
    print(f"Casting to [LG] webOS TV @ {args.ip}")
    print(f"  URL:  {stream_url}")
    print(f"  MIME: {mime}")

    # Stop any current playback
    dlna_stop()
    time.sleep(0.8)

    # Set the URI
    r = dlna_set_uri(stream_url, title=title, mime=mime)
    if r.status_code != 200:
        print(f"  ✗ SetURI failed ({r.status_code}): {r.text[:200]}")
        sys.exit(1)
    print("  ✓ URI set")
    time.sleep(2)  # let TV probe/buffer

    # Play
    r = dlna_play()
    if r.status_code == 200:
        print("  ✓ Playing!")
    else:
        print(f"  ✗ Play failed ({r.status_code}): {r.text[:200]}")
        sys.exit(1)

    # For local files, keep server alive while streaming
    if srv:
        print("\nStreaming... press Ctrl+C to stop.")
        try:
            while True:
                time.sleep(5)
                state, _ = dlna_transport_info()
                if state not in ("PLAYING", "PAUSED_PLAYBACK", "TRANSITIONING"):
                    print(f"\nPlayback ended (state: {state})")
                    break
        except KeyboardInterrupt:
            print("\nStopping...")
            dlna_stop()
        finally:
            srv.shutdown()

if __name__ == "__main__":
    main()
