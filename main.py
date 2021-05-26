from FR2T import fr2t

if __name__ == "__main__":
    config_path = "data/config.yaml"
    rss_path = "data/rss.yaml"

    fr = fr2t.FR2T(config_path, rss_path)
    fr.run()
