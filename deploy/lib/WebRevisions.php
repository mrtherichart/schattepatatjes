<?php
declare(strict_types=1);

/** Static-only web revisions. Never reads or writes the family server/data directory. */
final class WebRevisions {
    private const REPO = 'mrtherichart/schattepatatjes';
    private const REQUIRED = ['index.html','app.js','styles.css','sw.js','manifest.webmanifest','assets/icon.svg','assets/icon-192.png','assets/icon-512.png','assets/apple-touch-icon.png'];
    private const MAX_FILE = 2_000_000;
    private const MAX_TOTAL = 8_000_000;
    private string $root;

    public function __construct(string $publicRoot) {
        $this->root = rtrim($publicRoot, DIRECTORY_SEPARATOR);
    }
    private function stateDir(): string { return $this->root . '/.web-state'; }
    private function revisionsDir(): string { return $this->root . '/static/revisions'; }
    public function current(): ?array {
        $path = $this->stateDir() . '/current.json';
        if (!is_file($path)) return null;
        $data = json_decode((string)file_get_contents($path), true);
        if (!is_array($data)) throw new RuntimeException('Ongeldige webpublicatiestatus.');
        foreach (['current','previous'] as $name) {
            if (isset($data[$name]) && $data[$name] !== null && !self::validSha($data[$name]))
                throw new RuntimeException('Ongeldige revisie in publicatiestatus.');
        }
        return $data;
    }
    public static function validSha(string $sha): bool { return (bool)preg_match('/^[a-f0-9]{40}$/D', $sha); }
    public function file(string $sha, string $name): string {
        if (!self::validSha($sha) || !self::allowed($name)) throw new RuntimeException('Ongeldig webbestand.');
        return $this->revisionsDir() . '/' . $sha . '/' . $name;
    }
    private static function allowed(string $path): bool {
        if (in_array($path, self::REQUIRED, true)) return true;
        return (bool)preg_match('~^assets/[a-zA-Z0-9_-]+(?:/[a-zA-Z0-9_-]+)*\.(?:svg|png|webp|jpg|jpeg|gif|ico)$~D', $path);
    }
    private static function ensureDir(string $path): void {
        if (is_link($path)) throw new RuntimeException('Symbolische link geweigerd.');
        if (!is_dir($path) && !mkdir($path, 0750, true) && !is_dir($path)) throw new RuntimeException('Map maken mislukt.');
    }
    private function prepare(): void {
        self::ensureDir($this->stateDir());
        self::ensureDir($this->root . '/static');
        self::ensureDir($this->revisionsDir());
        // Refuse requests into the state area even if Apache rules were forgotten.
        $rules = "Require all denied\n";
        $guard = $this->stateDir() . '/.htaccess';
        if (!file_exists($guard)) file_put_contents($guard, $rules, LOCK_EX);
    }
    public function activate(string $sha): void {
        if (!self::validSha($sha)) throw new RuntimeException('Ongeldige commit-SHA.');
        if (!is_file($this->file($sha, 'index.html'))) throw new RuntimeException('Revisie niet aanwezig.');
        $this->prepare();
        $state = $this->current();
        if (($state['current'] ?? null) === $sha) return;
        $next = ['current'=>$sha, 'previous'=>$state['current'] ?? null, 'activatedAt'=>gmdate('c')];
        $tmp = tempnam($this->stateDir(), '.next-');
        if (!$tmp) throw new RuntimeException('Publicatie mislukt.');
        try {
            if (file_put_contents($tmp, json_encode($next, JSON_THROW_ON_ERROR), LOCK_EX) === false) throw new RuntimeException('Opslag mislukt.');
            if (!rename($tmp, $this->stateDir().'/current.json')) throw new RuntimeException('Omschakelen mislukt.');
        } finally { if (is_file($tmp)) unlink($tmp); }
    }
    public function rollback(): string {
        $state = $this->current();
        $previous = $state['previous'] ?? null;
        if (!is_string($previous) || !is_file($this->file($previous, 'index.html')))
            throw new RuntimeException('Geen eerdere revisie beschikbaar.');
        $this->activate($previous);
        return $previous;
    }
    /** Input: pinned commit SHA. A caller may supply a safe fetch function in isolated tests. */
    public function download(string $sha, ?callable $fetch = null): int {
        if (!self::validSha($sha)) throw new RuntimeException('Vul de volledige Git-commit-SHA in.');
        $fetch ??= [self::class,'fetchHttps'];
        $commit = json_decode($fetch('https://api.github.com/repos/'.self::REPO.'/git/commits/'.$sha, 200_000),true);
        $treeSha = $commit['tree']['sha'] ?? '';
        if (!is_string($treeSha) || !self::validSha($treeSha)) throw new RuntimeException('Git-commit niet gevonden.');
        $tree = json_decode($fetch('https://api.github.com/repos/'.self::REPO.'/git/trees/'.$treeSha.'?recursive=1', 600_000),true);
        if (!is_array($tree) || ($tree['truncated'] ?? true) || !isset($tree['tree']) || !is_array($tree['tree']))
            throw new RuntimeException('Onvolledige Git-boom.');
        $items=[]; $total=0;
        foreach ($tree['tree'] as $item) {
            $path=$item['path']??'';
            if (!str_starts_with($path,'web/')) continue;
            $name=substr($path,4);
            if (!self::allowed($name) || ($item['type']??'')!=='blob' || ($item['mode']??'')!=='100644')
                throw new RuntimeException('Onverwacht bestand in web/: '.$path);
            $size=(int)($item['size']??-1);
            if ($size < 0 || $size > self::MAX_FILE || !self::validSha((string)($item['sha']??'')))
                throw new RuntimeException('Ongeldig Git-bestand: '.$path);
            $total += $size;
            if ($total>self::MAX_TOTAL) throw new RuntimeException('Webrevisie is te groot.');
            $items[$name]=$item;
        }
        foreach (self::REQUIRED as $required) if (!isset($items[$required]))
            throw new RuntimeException('Webbestand ontbreekt: '.$required);
        $this->prepare();
        $destination=$this->revisionsDir().'/'.$sha;
        if (is_dir($destination)) {
            foreach (self::REQUIRED as $required) if (!is_file($destination.'/'.$required)) throw new RuntimeException('Onvolledige bestaande revisie.');
            return count($items);
        }
        $staging=$this->revisionsDir().'/.staging-'.$sha.'-'.bin2hex(random_bytes(5));
        self::ensureDir($staging);
        try {
            foreach ($items as $name=>$item) {
                $bytes=$fetch('https://raw.githubusercontent.com/'.self::REPO.'/'.$sha.'/web/'.$name, self::MAX_FILE);
                $gitSha=sha1('blob '.strlen($bytes)."\0".$bytes);
                if (strlen($bytes)!==(int)$item['size'] || !hash_equals($item['sha'],$gitSha))
                    throw new RuntimeException('Git-integriteitscontrole faalt: '.$name);
                $file=$staging.'/'.$name;
                self::ensureDir(dirname($file));
                if (file_put_contents($file,$bytes,LOCK_EX)===false) throw new RuntimeException('Schrijven mislukt.');
            }
            if (!rename($staging,$destination)) throw new RuntimeException('Revisie activeren mislukt.');
        } finally { if (is_dir($staging)) self::removeTree($staging); }
        return count($items);
    }
    private static function removeTree(string $dir): void {
        foreach (new DirectoryIterator($dir) as $node) {
            if ($node->isDot()) continue;
            if ($node->isDir() && !$node->isLink()) self::removeTree($node->getPathname());
            else unlink($node->getPathname());
        }
        rmdir($dir);
    }
    private static function fetchHttps(string $url, int $max): string {
        $host=strtolower((string)parse_url($url,PHP_URL_HOST));
        if (parse_url($url,PHP_URL_SCHEME)!=='https' || !in_array($host,['api.github.com','raw.githubusercontent.com'],true))
            throw new RuntimeException('GitHub-adres geweigerd.');
        $ctx=stream_context_create(['http'=>['timeout'=>12,'follow_location'=>0,'header'=>"User-Agent: Schattepatatjes-WebDeploy/1.0\r\nAccept: application/vnd.github+json\r\n"], 'ssl'=>['verify_peer'=>true,'verify_peer_name'=>true]]);
        $stream=@fopen($url,'rb',false,$ctx);
        if (!$stream) throw new RuntimeException('GitHub niet bereikbaar.');
        try {
            $status=$http_response_header[0]??'';
            if (!preg_match('~^HTTP/\S+ 200(?:\s|$)~',$status)) throw new RuntimeException('GitHub HTTP-fout.');
            $content=stream_get_contents($stream, $max+1);
            if ($content===false || strlen($content)>$max) throw new RuntimeException('Bestand te groot.');
            return $content;
        } finally { fclose($stream); }
    }
}
