{ pkgs }: {
  deps = [
    pkgs.openssh
    # Required for robotjs native module compilation in meowstik-agent
    pkgs.xorg.libXtst
    pkgs.libpng
    pkgs.gcc
    pkgs.gnumake
  ];
}
