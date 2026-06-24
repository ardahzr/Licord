# AUR packaging

This project ships two AUR recipes:

- `licord`: builds the app from the Git tag.
- `licord-bin`: installs the prebuilt `.deb` from a GitHub Release, which is faster for users.

The AUR recipes are configured for `https://github.com/ardahzr/Licord`.

Generate metadata:

```bash
cd packaging/aur/licord
makepkg --printsrcinfo > .SRCINFO

cd ../licord-bin
makepkg --printsrcinfo > .SRCINFO
```

Publish to AUR:

```bash
git clone ssh://aur@aur.archlinux.org/licord.git
cp packaging/aur/licord/PKGBUILD packaging/aur/licord/.SRCINFO licord/
cd licord
git add PKGBUILD .SRCINFO
git commit -m "Initial import"
git push
```

Repeat with `licord-bin` if you want the binary package too.
