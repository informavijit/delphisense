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
  end;

implementation

{ TOrderProcessor }

procedure TOrderProcessor.ProcessOrder(const OrderId: Integer);
var
  i: Integer;
  s: string;
begin
  // TODO: replace with real order lookup
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

function TOrderProcessor.CalculateDiscount(Amount: Double): Double;
begin
  Result := Amount * 0.1;
end;

end.
