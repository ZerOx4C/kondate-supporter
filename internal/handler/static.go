package handler

import (
	"crypto/sha256"
	"encoding/hex"
	"io"
	"io/fs"
	"net/http"
	"path"
	"strings"
)

// StaticETags は静的ファイルごとのETag(中身のsha256の先頭16バイトを16進にして引用符で囲んだもの)を、
// fs.FS上のパスをキーにして返す。embed配信用で、起動時に1度だけ作る。
// embedのファイルには更新時刻が無くLast-Modifiedが付かないので、中身から作ったETagで304を返せるようにする。
// ファイルはハッシュへ流し込み、中身をメモリに写さない。
func StaticETags(fsys fs.FS) (map[string]string, error) {
	etags := map[string]string{}
	err := fs.WalkDir(fsys, ".", func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		f, err := fsys.Open(p)
		if err != nil {
			return err
		}
		defer f.Close()
		h := sha256.New()
		if _, err := io.Copy(h, f); err != nil {
			return err
		}
		etags[p] = `"` + hex.EncodeToString(h.Sum(nil)[:16]) + `"`
		return nil
	})
	if err != nil {
		return nil, err
	}
	return etags, nil
}

// staticHandler は静的ファイルを配信する。応答にはすべてCache-Control: no-cacheを付け、毎回サーバーに確かめさせる。
// etagsがnilでなければ、引けたファイルのETagを付ける(If-None-Matchとの比較と304はhttp.FileServerが行う)。
// etagsがnil(ディスク配信)のときは、http.FileServerが付けるLast-Modifiedで304を返す。
func staticHandler(fsys fs.FS, etags map[string]string) http.Handler {
	files := http.FileServerFS(fsys)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-cache")
		if etag, ok := etags[strings.TrimPrefix(path.Clean(r.URL.Path), "/")]; ok {
			w.Header().Set("ETag", etag)
		}
		files.ServeHTTP(w, r)
	})
}
