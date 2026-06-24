# Maintainer: libuntu <libuntu@users.noreply.github.com>
pkgname=licord
pkgver=0.1.0
pkgrel=1
pkgdesc="A fast, native, resource-efficient communication client for Arch Linux / CachyOS (Better-VC)"
arch=('x86_64')
url="https://github.com/ardahzr/Licord"
license=('MIT')
depends=(
  'cairo'
  'desktop-file-utils'
  'gdk-pixbuf2'
  'glib2'
  'gtk3'
  'hicolor-icon-theme'
  'libsoup3'
  'openssl'
  'pango'
  'webkit2gtk-4.1'
  'gst-plugins-base'
  'gst-plugins-good'
  'gst-plugins-bad'
  'gst-plugins-ugly'
)
makedepends=('cargo' 'git' 'nodejs' 'pnpm' 'rust')
options=('!strip' '!debug')
source=("git+${url}.git#tag=v${pkgver}")
sha256sums=('SKIP')

build() {
  cd "${srcdir}/${pkgname}"
  pnpm install --frozen-lockfile
  pnpm tauri build --bundles deb
}

package() {
  cd "${srcdir}/${pkgname}/src-tauri/target/release/bundle/deb"
  bsdtar -xf "Licord_${pkgver}_amd64.deb" data.tar.gz
  bsdtar -xf data.tar.gz -C "${pkgdir}"
}
