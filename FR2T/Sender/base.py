from jinja2 import Template


class SenderBase:
    def __init__(self, config):
        self.config = config

    def render(self, template, args):
        template = Template(template)
        msg = template.render(args)
        return msg

    def send(self, text):
        return 1

    def edit(self, message_id, text):
        return 2
