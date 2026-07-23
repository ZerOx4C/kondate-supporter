// Package imagestore はレシピ画像をファイルシステムに保存・配信する。
// RaspberryPi Zeroの低メモリ制約のため、SQLiteのBLOBではなくファイルとして
// 保存し、アップロード・削除いずれも画像全体をメモリに載せずに処理する。
package imagestore

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
)

var extByContentType = map[string]string{
	"image/jpeg": "jpg",
	"image/png":  "png",
	"image/gif":  "gif",
	"image/webp": "webp",
}

// Store はディレクトリ配下に "{レシピID}.{拡張子}" として画像を保存する。
type Store struct {
	dir string
}

func New(dir string) *Store {
	return &Store{dir: dir}
}

// Save はrから読み取った画像を{id}.{拡張子}として保存し、拡張子を返す。
// 先頭512バイトで形式を判定してから残りをストリームコピーするため、
// 画像全体をメモリに載せない。対応形式(jpeg/png/gif/webp)以外は
// エラーを返す。既存の画像ファイル(拡張子が異なる場合を含む)は
// 保存前に削除する。
func (s *Store) Save(id int64, r io.Reader) (string, error) {
	if err := os.MkdirAll(s.dir, 0o755); err != nil {
		return "", err
	}

	head := make([]byte, 512)
	n, err := io.ReadFull(r, head)
	if err != nil && err != io.ErrUnexpectedEOF && err != io.EOF {
		return "", err
	}
	head = head[:n]

	ext, ok := extByContentType[http.DetectContentType(head)]
	if !ok {
		return "", fmt.Errorf("unsupported image type")
	}

	if err := s.Delete(id); err != nil {
		return "", err
	}

	f, err := os.Create(s.Path(id, ext))
	if err != nil {
		return "", err
	}
	defer f.Close()

	if _, err := f.Write(head); err != nil {
		return "", err
	}
	if _, err := io.Copy(f, r); err != nil {
		return "", err
	}
	return ext, nil
}

// Delete は{id}.*にマッチする既存画像ファイルをすべて削除する
// (拡張子を呼び出し側で覚えておかなくてよいよう常にglobで探す)。
func (s *Store) Delete(id int64) error {
	matches, err := filepath.Glob(filepath.Join(s.dir, fmt.Sprintf("%d.*", id)))
	if err != nil {
		return err
	}
	for _, m := range matches {
		if err := os.Remove(m); err != nil && !os.IsNotExist(err) {
			return err
		}
	}
	return nil
}

func (s *Store) Path(id int64, ext string) string {
	return filepath.Join(s.dir, fmt.Sprintf("%d.%s", id, ext))
}
