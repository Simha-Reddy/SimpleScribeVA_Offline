# -*- mode: python ; coding: utf-8 -*-

import os
from glob import glob
from PyInstaller.utils.hooks import collect_submodules

block_cipher = None
project_root = os.getcwd()

a = Analysis(
    ['launch_simplescribe.py'],
    pathex=[project_root],
    binaries=[],
    datas=[
        *[(f, "templates")         for f in glob("templates/*.html")],
        *[(f, "templates/default") for f in glob("templates/default/*")],
        *[(f, "templates/custom")  for f in glob("templates/custom/*")],
        *[(f, "static")            for f in glob("static/*")],
        *[(f, "whispercpp")        for f in glob("whispercpp/*")],
        *[(f, ".") for f in [
            "config.json",
            "live_transcript.txt",
            "monitor_transcription.py",
            "run_local_server.py",
            "record_audio.py",
            "requirements.txt",
            "icon.ico",
            "README.md",
        ]],
    ],
    hiddenimports=(collect_submodules('flask')
                   + collect_submodules('dotenv')
                   + collect_submodules('subprocess')
                   + collect_submodules('json')
                   + collect_submodules('webbrowser')
                   + collect_submodules('psutil')
                   + ["psutil"]),
    hookspath=[],
    runtime_hooks=[],
    excludes=["tkinter"],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    name='SimpleScribeVA',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    icon=os.path.join(project_root, 'icon.ico'),
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='SimpleScribeVA'
)