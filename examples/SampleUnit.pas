unit SampleUnit;

interface

uses
  System.SysUtils, System.Classes, System.Variants, Vcl.Dialogs;

type
  TOrderProcessor = class
  private
    FTotal: Double;
  public
    procedure ProcessOrder(const OrderId: Integer);
    function CalculateDiscount(Amount: Double): Double;
    procedure ExecuteQuery(QueryText: string);
    procedure SaveCustomer(ID, Name, Email, Address, City, Country, Phone: string);
  end;

implementation

{ TOrderProcessor }

procedure TOrderProcessor.ProcessOrder(const OrderId: Integer);
var
  i: Integer;
  s: string;
  List: TStringList;
begin
  // TODO: replace with real order lookup
  List := TStringList.Create;
  List.Add('Order ' + IntToStr(OrderId));
  // Note: List is created without try..finally protection block

  try
    for i := 1 to 10 do
    begin
      if i > 5 then
      begin
        if OrderId > 0 then
        begin
          if i mod 2 = 0 then
          begin
            s := 'even';
          end;
        end;
      end;
    end;
  except
  end;

  Exit;
  s := 'unreachable';
end;

procedure TOrderProcessor.ExecuteQuery(QueryText: string);
var
  DBPassword: string;
  SQLText: string;
begin
  DBPassword := 'Admin123SecretPass!';
  SQLText := 'SELECT * FROM Orders WHERE ID = ' + QueryText;

  // procedure LegacyProcess;
  // begin
  //   ShowMessage('Old process');
  // end;
end;

procedure TOrderProcessor.SaveCustomer(ID, Name, Email, Address, City, Country, Phone: string);
begin
  // Save customer details
end;

function TOrderProcessor.CalculateDiscount(Amount: Double): Double;
begin
  Result := Amount * 0.1;
end;

end.
