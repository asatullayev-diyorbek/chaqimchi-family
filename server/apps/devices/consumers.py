from channels.generic.websocket import AsyncJsonWebsocketConsumer


class EnrollConsumer(AsyncJsonWebsocketConsumer):
    """ws/enroll/<device_id>/ — installer connects here after generate-code
    and waits passively for the {"event": "linked"} push."""

    async def connect(self):
        self.device_id = self.scope["url_route"]["kwargs"]["device_id"]
        self.group_name = f"enroll_{self.device_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def enroll_linked(self, event):
        await self.send_json({"event": event["event"]})
