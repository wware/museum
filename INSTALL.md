# Installation Instructions

You're running into Docker permission issues. Here are your options:

## Recommended: Fix Docker Permissions

Add yourself to the docker group:
```bash
sudo usermod -aG docker $USER
```

Then **log out and log back in** (or run `newgrp docker`), and Docker will work without sudo.

After that:
```bash
make build
make run
```

## Alternative: Install MkDocs System-Wide

Install MkDocs via apt:
```bash
sudo apt update
sudo apt install -y mkdocs mkdocs-material
```

Then run the development server:
```bash
mkdocs serve
```

Visit http://localhost:8000

## Alternative: Manual Docker Build

Run Docker commands manually with sudo:
```bash
# Build the image
sudo docker build -t arcane-museum .

# Run the container
sudo docker run --rm -p 8080:80 arcane-museum
```

Visit http://localhost:8080

## Alternative: Python Virtual Environment

If you have sudo access to install python3-venv:
```bash
sudo apt install python3-venv python3-pip
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
mkdocs serve
```

## Quick Test Without Installation

You can view the standalone demo:
```bash
# Open the standalone HTML file
python3 -m http.server 8000
```

Then visit http://localhost:8000/mass_spring.html

---

**Recommendation**: Fix the Docker permissions (option 1) for the full museum experience with all features.
