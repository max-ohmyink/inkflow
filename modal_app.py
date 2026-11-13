import os
import subprocess
import modal

app = modal.App("inkflow")

# Source only is uploaded; `pnpm install` and `pnpm build:all` run inside the image build.
image = modal.Image.from_dockerfile(
    "Dockerfile",
    add_python="3.12",
    ignore=modal.FilePatternMatcher.from_file(".dockerignore"),
)

uploads = modal.Volume.from_name("inkflow-uploads", create_if_missing=True)


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("inkflow-env")],
    volumes={"/app/uploads": uploads},
    max_containers=1,  # stencil worker runs in-process; do not scale out
    scaledown_window=300,
    timeout=600,
)
@modal.concurrent(max_inputs=20)
@modal.web_server(port=3000, startup_timeout=60)
def web():
    subprocess.Popen(
        ["node", "dist/index.js"],
        cwd="/app",
        env={**os.environ, "PORT": "3000", "NODE_ENV": "production"},
    )
