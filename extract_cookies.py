import os, json, sqlite3, shutil, tempfile
from base64 import b64decode
try:
    from Cryptodome.Cipher import AES
except ImportError:
    from Crypto.Cipher import AES
import win32crypt

chrome_dir = os.path.join(os.environ['LOCALAPPDATA'], 'Google', 'Chrome', 'User Data')
local_state_path = os.path.join(chrome_dir, 'Local State')

with open(local_state_path, 'r') as f:
    local_state = json.load(f)
encrypted_key = b64decode(local_state['os_crypt']['encrypted_key'])
encrypted_key = encrypted_key[5:]  # remove 'DPAPI' prefix
key = win32crypt.CryptUnprotectData(encrypted_key, None, None, None, 0)[1]

cookies_db = os.path.join(chrome_dir, 'Default', 'Network', 'Cookies')
tmp_db = os.path.join(tempfile.gettempdir(), 'chrome_cookies_copy')
shutil.copy2(cookies_db, tmp_db)

conn = sqlite3.connect(tmp_db)
conn.text_factory = bytes
cookies = []
for row in conn.execute("SELECT host_key, path, is_secure, expires_utc, name, value, encrypted_value FROM cookies WHERE host_key LIKE '%youtube%' OR host_key LIKE '%google%'"):
    host_key, path, is_secure, expires_utc, name, value, encrypted_value = row
    host_key = host_key.decode() if isinstance(host_key, bytes) else host_key
    path = path.decode() if isinstance(path, bytes) else path
    name = name.decode() if isinstance(name, bytes) else name
    
    if value and value != b'':
        val = value.decode() if isinstance(value, bytes) else value
    else:
        try:
            nonce, ciphertext, tag = encrypted_value[3:15], encrypted_value[15:-16], encrypted_value[-16:]
            cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
            val = cipher.decrypt_and_verify(ciphertext, tag).decode()
        except:
            try:
                val = win32crypt.CryptUnprotectData(encrypted_value, None, None, None, 0)[1].decode()
            except:
                continue
    
    secure = 'TRUE' if is_secure else 'FALSE'
    expires = str(int(expires_utc / 1000000 - 11644473600)) if expires_utc else '0'
    cookies.append((host_key, path, secure, expires, name, val))

conn.close()
os.remove(tmp_db)

with open('cookies.txt', 'w') as f:
    f.write('# Netscape HTTP Cookie File\n')
    for host_key, path, secure, expires, name, val in cookies:
        f.write(f'{host_key}\tTRUE\t{path}\t{secure}\t{expires}\t{name}\t{val}\n')

print(f'Exported {len(cookies)} cookies (youtube/google) to cookies.txt')
