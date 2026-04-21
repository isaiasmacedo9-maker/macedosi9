import asyncio
import json
import sys

from services.official_data_sync import import_official_csv_data


async def _run():
    clients_path = sys.argv[1] if len(sys.argv) > 1 else None
    financial_path = sys.argv[2] if len(sys.argv) > 2 else None
    result = await import_official_csv_data(clients_path, financial_path)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(_run())

