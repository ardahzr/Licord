# Maintainer: Your Name <youremail@example.com>
pkgname=licord
pkgver=0.1.0
pkgrel=1
pkgdesc="A fast, native, resource-efficient communication client for Arch Linux / CachyOS (Better-VC)"
arch=('x86_64')
url="https://github.com/yourusername/licord"
license=('MIT')
depends=(
  'webkit2gtk-4.1'
  'gtk3'
  'cairo'
  'pango'
  'glib2'
  'openssl'
  'libsoup3'
  'gst-plugins-base'
  'gst-plugins-good'
  'gst-plugins-bad'
  'gst-plugins-ugly'
)
makedepends=('cargo' 'npm' 'pnpm' 'git')
source=("git+file://${PWD}")
sha256sums=('SKIP')

build() {
  cd "$srcdir"
  export YARN_ENABLE_IMMUTABLE_INSTALLS=false
  pnpm install
  pnpm tauri build
}

package() {
  cd "$srcdir/src-tauri/target/release/bundle/deb/${pkgname}_${pkgver}_amd64/data"
  cp -r usr "$pkgdir/"
}
